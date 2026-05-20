import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido.' })
  email: string;
}
