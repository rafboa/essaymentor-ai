import { numberSentences, splitIntoParagraphs } from './sentences';

describe('sentences', () => {
  it('memecah paragraf dan kalimat', () => {
    const text = 'Kalimat satu. Kalimat dua!\n\nParagraf baru? Ya.';
    expect(splitIntoParagraphs(text)).toEqual([
      ['Kalimat satu.', 'Kalimat dua!'],
      ['Paragraf baru?', 'Ya.'],
    ]);
  });

  it('tidak memecah pada singkatan dan angka desimal', () => {
    const text =
      'Saya bertemu Dr. Sari dll. di kampus. IPK saya 3.85 tahun lalu.';
    expect(splitIntoParagraphs(text)).toEqual([
      ['Saya bertemu Dr. Sari dll. di kampus.', 'IPK saya 3.85 tahun lalu.'],
    ]);
  });

  it('menyertakan tanda kutip penutup', () => {
    expect(
      splitIntoParagraphs('Ibu berkata, "Belajarlah." Saya mengangguk.'),
    ).toEqual([['Ibu berkata, "Belajarlah."', 'Saya mengangguk.']]);
  });

  it('menomori kalimat lintas paragraf', () => {
    const { numbered, count } = numberSentences('A satu. A dua.\n\nB satu');
    expect(count).toBe(3);
    expect(numbered).toBe('[0] A satu.\n[1] A dua.\n\n[2] B satu');
  });
});
