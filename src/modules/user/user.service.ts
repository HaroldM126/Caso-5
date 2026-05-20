import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user/user.entity';
import { CreateUserDto } from '../../dtos/user/create-user.dto';
import { UpdateUserDto } from '../../dtos/user/update-user.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password } = createUserDto;

    const userExists = await this.userRepository.findOne({ where: { email } });
    if (userExists) {
      throw new BadRequestException('El correo ya está registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = this.userRepository.create({
      ...createUserDto,
      password_hash,
    });

    const saved = await this.userRepository.save(newUser);
    return this.sanitize(saved) as any;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();
    return users.map((u) => this.sanitize(u) as any);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async updateRole(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }
    if (updateUserDto.nombre) {
      user.nombre = updateUserDto.nombre;
    }
    const saved = await this.userRepository.save(user);
    return this.sanitize(saved) as any;
  }

  async getProfile(user: User): Promise<User> {
    const u = await this.findOne(user.id);
    return this.sanitize(u) as any;
  }

  private sanitize(user: User) {
    const { password_hash, ...rest } = user as any;
    return rest as Partial<User>;
  }
}
