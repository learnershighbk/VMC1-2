import { z } from "zod";

// 사용자 역할 타입
export type UserRole = "learner" | "instructor";

// 휴대폰번호 형식 검증을 위한 타입
export type PhoneNumber = string;

// 회원가입 요청 타입
export type SignupRequest = {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phoneNumber: PhoneNumber;
  agreeToTerms: boolean;
};

// 사용자 프로필 타입
export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phoneNumber?: PhoneNumber;
  createdAt: string;
  updatedAt: string;
};

// 약관 동의 타입
export type TermsAgreement = {
  id: string;
  userId: string;
  agreedAt: string;
};

// 현재 사용자 타입 (기존 유지)
export type CurrentUser = {
  id: string;
  email: string | null;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
};

export type CurrentUserSnapshot =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "unauthenticated"; user: null }
  | { status: "loading"; user: CurrentUser | null };

export type CurrentUserContextValue = CurrentUserSnapshot & {
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
};

// Zod 스키마 정의
export const phoneNumberSchema = z
  .string()
  .regex(/^010-\d{4}-\d{4}$/, "올바른 휴대폰번호 형식이 아닙니다 (010-XXXX-XXXX)");

export const signupRequestSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다"),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다"),
  role: z.enum(["learner", "instructor"], {
    errorMap: () => ({ message: "역할을 선택해주세요 (학습자 또는 강사)" })
  }),
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자를 초과할 수 없습니다"),
  phoneNumber: phoneNumberSchema,
  agreeToTerms: z.boolean().refine(val => val === true, "약관에 동의해야 합니다")
});

export const termsAgreementSchema = z.object({
  userId: z.string().uuid("올바른 사용자 ID가 아닙니다")
});

export type SignupRequestInput = z.input<typeof signupRequestSchema>;
export type SignupRequestOutput = z.output<typeof signupRequestSchema>;
export type TermsAgreementInput = z.input<typeof termsAgreementSchema>;
export type TermsAgreementOutput = z.output<typeof termsAgreementSchema>;
