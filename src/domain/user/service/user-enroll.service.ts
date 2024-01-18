import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRepository } from '../data/repository/main/user.repository';
import { EnrollInfoRequestDto } from '../dto/request/enroll-info.request.dto';
import { User } from '../data/entity/user.entity';
import { EnrollCareEmailRequestDto } from '../dto/request/enroll-care-email.reuqest.dto';
import { EmailService } from 'src/common/email/email.service';
import { CareEnrollRepository } from '../data/repository/in-memory/care-enroll.repository';
import { EnrollCareCertRequestDto } from '../dto/request/enroll-care-cert.request.dto';

@Injectable()
export class UserEnrollService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly careEnrollRepository: CareEnrollRepository,
  ) {}

  async enrollInfo(dto: EnrollInfoRequestDto, user: User): Promise<void> {
    const { role } = dto;

    // 역할 등록
    user.role = role;
    // 피보호자의 경우에는 여기서 등록이 마무리 될 수 있도록
    if (role == 'CareRecipient') user.isEnrolled = true;
    await this.userRepository.save(user);
  }

  async enrollCareEmail(
    dto: EnrollCareEmailRequestDto,
    user: User,
  ): Promise<void> {
    const { email } = dto;
    const careRecipient = await this.userRepository.findByEmail(email);

    if (!careRecipient)
      throw new NotFoundException('피보호자의 계정이 존재하지 않습니다.');
    if (email == user.email)
      throw new BadRequestException('자기 자신을 등록할 수 없습니다.');

    const certificate = String(Math.floor(Math.random() * 10000)).padStart(
      4,
      '0',
    );

    // certificate 이메일로 발송
    await this.emailService.sendCareRelationshipCert(email, certificate);
    // certificate을 redis로 저장
    await this.careEnrollRepository.saveCertFor30m(
      user.email,
      email,
      certificate,
    );
  }

  async enrollCareCert(
    dto: EnrollCareCertRequestDto,
    user: User,
  ): Promise<void> {
    // certficate의 유효성 검사
    const key = `cert:${user.email}:${dto.email}`;
    const cert = await this.careEnrollRepository.getCert(key);
    if (!cert) throw new UnauthorizedException('유효한 인증정보가 없습니다.');
    if (cert != dto.certificate)
      throw new UnauthorizedException('인증정보가 일치하지 않습니다.');

    // 보호관계 등록
    return;
  }
}
