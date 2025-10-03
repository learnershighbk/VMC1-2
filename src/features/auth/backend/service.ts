import { Context } from "hono";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  SignupRequest,
  SignupResponse,
  TermsAgreementRequest,
  TermsAgreementResponse
} from "./schema";
import { AUTH_ERRORS } from "./error";

/**
 * 사용자 등록 서비스
 * Supabase Auth 사용자 생성 후 프로필 정보를 데이터베이스에 저장
 */
export async function registerUser(
  c: Context,
  signupData: SignupRequest
): Promise<{ ok: boolean; data?: SignupResponse; error?: { code: string; message: string } }> {
  try {
    const supabase = getSupabaseServerClient(c);

    // 1. Supabase Auth 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return {
          ok: false,
          error: AUTH_ERRORS.EMAIL_ALREADY_EXISTS
        };
      }
      return {
        ok: false,
        error: AUTH_ERRORS.USER_CREATION_FAILED
      };
    }

    if (!authData.user?.id) {
      return {
        ok: false,
        error: AUTH_ERRORS.USER_CREATION_FAILED
      };
    }

    // 2. 사용자 프로필 정보 저장
    const { error: profileError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email: signupData.email,
        role: signupData.role,
        name: signupData.name,
        phone_number: signupData.phoneNumber,
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return {
        ok: false,
        error: AUTH_ERRORS.PROFILE_CREATION_FAILED
      };
    }

    // 3. 성공 응답 반환
    return {
      ok: true,
      data: {
        user: {
          id: authData.user.id,
          email: signupData.email,
          role: signupData.role,
          name: signupData.name,
          phoneNumber: signupData.phoneNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        message: "회원가입이 완료되었습니다"
      }
    };

  } catch (error) {
    console.error("User registration error:", error);
    return {
      ok: false,
      error: AUTH_ERRORS.DATABASE_ERROR
    };
  }
}

/**
 * 약관 동의 처리 서비스
 * 사용자의 약관 동의 이력을 저장
 */
export async function agreeToTerms(
  c: Context,
  termsData: TermsAgreementRequest
): Promise<{ ok: boolean; data?: TermsAgreementResponse; error?: { code: string; message: string } }> {
  try {
    const supabase = getSupabaseServerClient(c);

    // 1. 기존 약관 동의 확인 (중복 방지)
    const { data: existingAgreement } = await supabase
      .from("terms_agreements")
      .select("id")
      .eq("user_id", termsData.userId)
      .single();

    if (existingAgreement) {
      return {
        ok: false,
        error: AUTH_ERRORS.TERMS_ALREADY_AGREED
      };
    }

    // 2. 약관 동의 이력 저장
    const { data: agreementData, error: agreementError } = await supabase
      .from("terms_agreements")
      .insert({
        user_id: termsData.userId,
      })
      .select()
      .single();

    if (agreementError) {
      console.error("Terms agreement error:", agreementError);
      return {
        ok: false,
        error: AUTH_ERRORS.TERMS_AGREEMENT_FAILED
      };
    }

    // 3. 성공 응답 반환
    return {
      ok: true,
      data: {
        agreement: {
          id: agreementData.id,
          userId: agreementData.user_id,
          agreedAt: agreementData.agreed_at
        },
        message: "약관 동의가 완료되었습니다"
      }
    };

  } catch (error) {
    console.error("Terms agreement error:", error);
    return {
      ok: false,
      error: AUTH_ERRORS.DATABASE_ERROR
    };
  }
}
