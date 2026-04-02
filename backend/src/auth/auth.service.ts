import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";

export type UserRole = "project_developer" | "corporation" | "verifier" | "admin";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithPublicKey(publicKey: string, role: UserRole = "corporation"): Promise<{ access_token: string }> {
    // Upsert user
    await this.prisma.user.upsert({
      where:  { publicKey },
      update: {},
      create: { publicKey, role },
    });

    const payload = { sub: publicKey, role };
    return { access_token: this.jwt.sign(payload) };
  }

  async validateUser(publicKey: string): Promise<{ publicKey: string; role: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { publicKey } });
    return user ? { publicKey: user.publicKey, role: user.role } : null;
  }
}
