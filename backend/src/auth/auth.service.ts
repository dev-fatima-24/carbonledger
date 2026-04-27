import { Injectable, UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";

export type UserRole = "project_developer" | "corporation" | "verifier" | "admin";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithPublicKey(publicKey: string): Promise<{ access_token: string }> {
    // Role is NEVER accepted from the request body.
    // New users always start as "corporation"; existing users keep their DB role.
    try {
      const user = await this.prisma.user.upsert({
        where:  { publicKey },
        update: {},
        create: { publicKey, role: "corporation" },
      });

      const payload = { sub: publicKey, role: user.role };
      return { access_token: this.jwt.sign(payload) };
    } catch (error) {
      // P2024: pool timeout — return 503 instead of crashing the connection
      if (error?.code === "P2024") {
        throw new ServiceUnavailableException("Service temporarily unavailable — please retry");
      }
      throw error;
    }
  }

  async validateUser(publicKey: string): Promise<{ publicKey: string; role: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { publicKey } });
    return user ? { publicKey: user.publicKey, role: user.role } : null;
  }
}
