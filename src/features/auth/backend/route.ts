import { Hono } from "hono";
import { z } from "zod";
import { registerUser, agreeToTerms } from "./service";
import {
  signupRequestSchemaBackend,
  termsAgreementRequestSchemaBackend,
  signupResponseSchema,
  termsAgreementResponseSchema
} from "./schema";
import { AUTH_ERRORS } from "./error";

// 인증 관련 라우터
export function registerAuthRoutes(app: Hono) {
  // 회원가입 엔드포인트
  app.post("/auth/signup", async (c) => {
    try {
      // 1. 요청 데이터 검증
      const body = await c.req.json();
      const validatedData = signupRequestSchemaBackend.parse(body);

      // 2. 사용자 등록 처리
      const result = await registerUser(c, validatedData);

      if (!result.ok) {
        return c.json(
          {
            success: false,
            error: {
              code: result.error!.code,
              message: result.error!.message
            }
          },
          400
        );
      }

      // 3. 성공 응답 반환
      return c.json(
        {
          success: true,
          data: result.data
        },
        201
      );

    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "입력값이 올바르지 않습니다",
              details: error.errors
            }
          },
          400
        );
      }

      console.error("Signup error:", error);
      return c.json(
        {
          success: false,
          error: AUTH_ERRORS.DATABASE_ERROR
        },
        500
      );
    }
  });

  // 약관 동의 엔드포인트
  app.post("/auth/terms-agreement", async (c) => {
    try {
      // 1. 요청 데이터 검증
      const body = await c.req.json();
      const validatedData = termsAgreementRequestSchemaBackend.parse(body);

      // 2. 약관 동의 처리
      const result = await agreeToTerms(c, validatedData);

      if (!result.ok) {
        return c.json(
          {
            success: false,
            error: {
              code: result.error!.code,
              message: result.error!.message
            }
          },
          400
        );
      }

      // 3. 성공 응답 반환
      return c.json(
        {
          success: true,
          data: result.data
        },
        201
      );

    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "입력값이 올바르지 않습니다",
              details: error.errors
            }
          },
          400
        );
      }

      console.error("Terms agreement error:", error);
      return c.json(
        {
          success: false,
          error: AUTH_ERRORS.DATABASE_ERROR
        },
        500
      );
    }
  });
}
