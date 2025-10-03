import { z } from "zod";
import { signupRequestSchema, termsAgreementSchema } from "../types";

// 회원가입 요청 스키마 (백엔드용)
export const signupRequestSchemaBackend = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다"),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다"),
  role: z.enum(["learner", "instructor"], {
    errorMap: () => ({ message: "역할을 선택해주세요 (학습자 또는 강사)" })
  }),
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자를 초과할 수 없습니다"),
  phoneNumber: z.string().regex(/^010-\d{4}-\d{4}$/, "올바른 휴대폰번호 형식이 아닙니다 (010-XXXX-XXXX)"),
  agreeToTerms: z.boolean().refine(val => val === true, "약관에 동의해야 합니다")
});

// 약관 동의 요청 스키마 (백엔드용)
export const termsAgreementRequestSchemaBackend = z.object({
  userId: z.string().uuid("올바른 사용자 ID가 아닙니다")
});

// 회원가입 응답 스키마
export const signupResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(["learner", "instructor"]),
    name: z.string(),
    phoneNumber: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
  }),
  message: z.string()
});

// 약관 동의 응답 스키마
export const termsAgreementResponseSchema = z.object({
  agreement: z.object({
    id: z.string(),
    userId: z.string(),
    agreedAt: z.string()
  }),
  message: z.string()
});

export type SignupRequest = z.input<typeof signupRequestSchemaBackend>;
export type SignupResponse = z.output<typeof signupResponseSchema>;
export type TermsAgreementRequest = z.input<typeof termsAgreementRequestSchemaBackend>;
export type TermsAgreementResponse = z.output<typeof termsAgreementResponseSchema>;
