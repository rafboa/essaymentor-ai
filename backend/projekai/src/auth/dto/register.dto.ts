import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(255, { message: 'Email maksimal 255 karakter.' })
  email!: string;

  @IsString({ message: 'Nama lengkap harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi.' })
  @MinLength(2, { message: 'Nama lengkap minimal 2 karakter.' })
  @MaxLength(100, { message: 'Nama lengkap maksimal 100 karakter.' })
  fullName!: string;

  @IsString({ message: 'Password harus berupa teks.' })
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @MaxLength(64, { message: 'Password maksimal 64 karakter.' })
  password!: string;
}
