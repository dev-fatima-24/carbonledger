import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { IsString } from "class-validator";
import { LoginRateLimitGuard } from "./login-rate-limit.guard";

class LoginDto {
  @IsString() publicKey: string;
  // role is intentionally NOT accepted from the client — it is always read from the DB
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(LoginRateLimitGuard)
  @SkipThrottle({ default: true, auth: true, retire: true })
  login(@Body() dto: LoginDto) {
    return this.authService.loginWithPublicKey(dto.publicKey);
  }
}
