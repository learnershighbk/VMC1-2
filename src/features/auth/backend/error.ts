// 인증 관련 에러 코드 정의
export const AUTH_ERRORS = {
  EMAIL_ALREADY_EXISTS: {
    code: "EMAIL_ALREADY_EXISTS",
    message: "이미 등록된 이메일입니다"
  },
  USER_CREATION_FAILED: {
    code: "USER_CREATION_FAILED",
    message: "사용자 생성에 실패했습니다"
  },
  PROFILE_CREATION_FAILED: {
    code: "PROFILE_CREATION_FAILED",
    message: "프로필 생성에 실패했습니다"
  },
  TERMS_AGREEMENT_FAILED: {
    code: "TERMS_AGREEMENT_FAILED",
    message: "약관 동의 처리에 실패했습니다"
  },
  TERMS_ALREADY_AGREED: {
    code: "TERMS_ALREADY_AGREED",
    message: "이미 약관에 동의했습니다"
  },
  INVALID_USER_ID: {
    code: "INVALID_USER_ID",
    message: "올바르지 않은 사용자 ID입니다"
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "데이터베이스 오류가 발생했습니다"
  }
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;
