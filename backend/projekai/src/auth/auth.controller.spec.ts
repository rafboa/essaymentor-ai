import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { AuthUser } from './auth-user';

describe('AuthController', () => {
  it('delegates login and returns the current user from the request', async () => {
    const auth = {
      login: jest.fn(() => Promise.resolve({ access_token: 't' })),
      register: jest.fn(),
    };
    const controller = new AuthController(auth as unknown as AuthService);
    const dto = { email: 'a@b.test', password: 'x' };

    await expect(controller.login(dto)).resolves.toEqual({ access_token: 't' });
    expect(auth.login).toHaveBeenCalledWith(dto);

    const me: AuthUser = {
      userId: 'u1',
      email: 'a@b.test',
      fullName: 'A',
      role: 'ADMIN',
    };
    expect(controller.getProfile(me)).toBe(me);
  });
});
