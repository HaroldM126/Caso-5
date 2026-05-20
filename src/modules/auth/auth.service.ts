import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { User, Role } from '../../entities/user/user.entity';
import { Account } from '../../entities/account/account.entity';
import { RegisterDto } from '../../dtos/auth/register.dto';
import { LoginDto } from '../../dtos/auth/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto) {
    const { nombre, email, password } = registerDto;

    const userExists = await this.userRepository.findOne({ where: { email } });
    if (userExists) {
      throw new BadRequestException('El usuario ya existe con ese email');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newUser = queryRunner.manager.create(User, {
        nombre,
        email,
        password_hash,
        role: Role.USER,
      });

      const savedUser = await queryRunner.manager.save(newUser);

      const newAccount = queryRunner.manager.create(Account, {
        user: savedUser,
        saldo: 0,
      });

      await queryRunner.manager.save(newAccount);

      await queryRunner.commitTransaction();

      // No retornar el password_hash
      const { password_hash: _, ...userWithoutPassword } = savedUser;

      const payload = {
        sub: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
      };

      return {
        user: userWithoutPassword,
        access_token: await this.jwtService.signAsync(payload),
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Error al registrar usuario: ' + error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
