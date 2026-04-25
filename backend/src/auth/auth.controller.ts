import { Controller, Post, Body } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService, UserRole } from "./auth.service";
import { IsString, IsIn } from "class-validator";

class LoginDto {
  @IsString() publicKey: string;
  @IsIn(["project_developer", "corporation", "verifier", "admin"])
  role: UserRole;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.loginWithPublicKey(dto.publicKey, dto.role);
  }
}
