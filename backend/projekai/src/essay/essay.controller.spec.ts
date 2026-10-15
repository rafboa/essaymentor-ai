import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { EssayController } from './essay.controller';
import type { EssayService } from './essay.service';
import type { AuthUser } from '../auth/auth-user';

const user: AuthUser = {
  userId: 'u1',
  email: 'a@b.test',
  fullName: 'A',
  role: 'USER',
};
const dto = { content: 'x'.repeat(60), draftId: 'd1' };

function setup(service: Partial<Record<keyof EssayService, jest.Mock>>) {
  const controller = new EssayController(service as unknown as EssayService);
  const writes: string[] = [];
  const res = Object.assign(new EventEmitter(), {
    writableEnded: false,
    writableFinished: false,
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => writes.push(chunk)),
    end: jest.fn(function (this: {
      writableEnded: boolean;
      writableFinished: boolean;
    }) {
      this.writableEnded = true;
      this.writableFinished = true;
    }),
  });
  const run = () =>
    controller.evaluateStream(dto, user, res as unknown as Response);
  return { res, writes, run };
}

beforeAll(() => Logger.overrideLogger(false));

describe('EssayController.evaluateStream', () => {
  it('rejects a foreign draft as a normal HTTP error, before any SSE header', async () => {
    const { res, run } = setup({
      assertDraftOwner: jest
        .fn()
        .mockRejectedValue(new NotFoundException('nope')),
      submitAndEvaluateStream: jest.fn(),
    });

    await expect(run()).rejects.toBeInstanceOf(NotFoundException);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('turns an exception after the headers into an error event and closes the stream', async () => {
    const { res, writes, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest
        .fn()
        .mockRejectedValue(new Error('P2003 foreign key')),
    });

    await run();

    expect(writes.at(-1)).toMatch(/^event: error\ndata: /);
    // Internal details stay in the log, not in the client message.
    expect(writes.at(-1)).not.toContain('P2003');
    expect(res.end).toHaveBeenCalled();
  });

  it('passes a 4xx message through to the client', async () => {
    const { writes, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Draft tidak ditemukan.')),
    });

    await run();

    expect(writes.at(-1)).toContain('Draft tidak ditemukan.');
  });

  it('hides a 5xx message', async () => {
    const { writes, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest
        .fn()
        .mockRejectedValue(new InternalServerErrorException('db detail')),
    });

    await run();

    expect(writes.at(-1)).not.toContain('db detail');
  });

  it('streams service events and ends the response', async () => {
    const { res, writes, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest.fn(
        (_d, _u, emit: (e: string, d: unknown) => void) => {
          emit('status', { message: 'hi' });
          emit('done', { ok: true });
          return Promise.resolve();
        },
      ),
    });

    await run();

    expect(writes).toEqual([
      'event: status\ndata: {"message":"hi"}\n\n',
      'event: done\ndata: {"ok":true}\n\n',
    ]);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('aborts the evaluation when the client disconnects mid-stream', async () => {
    let signal: AbortSignal | undefined;
    const { res, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest.fn((_d, _u, _emit, s: AbortSignal) => {
        signal = s;
        res.emit('close'); // the socket goes away before the stream ends
        return Promise.resolve();
      }),
    });

    await run();

    expect(signal?.aborted).toBe(true);
  });

  it('does not abort on the close that follows a normal end', async () => {
    let signal: AbortSignal | undefined;
    const { res, run } = setup({
      assertDraftOwner: jest.fn().mockResolvedValue(undefined),
      submitAndEvaluateStream: jest.fn((_d, _u, _emit, s: AbortSignal) => {
        signal = s;
        return Promise.resolve();
      }),
    });

    await run();
    res.emit('close');

    expect(signal?.aborted).toBe(false);
  });
});
