"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { UserRole, SignupRequest } from "@/features/auth/types";
import { apiClient } from "@/lib/remote/api-client";
import { getRoleBasedRedirectPath } from "@/features/auth/lib/role-redirect";

const defaultFormState = {
  email: "",
  password: "",
  confirmPassword: "",
  role: "learner" as UserRole,
  name: "",
  phoneNumber: "",
  agreeToTerms: false,
};

type SignupPageProps = {
  params: Promise<Record<string, never>>;
};

export default function SignupPage({ params }: SignupPageProps) {
  void params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, refresh } = useCurrentUser();
  const [formState, setFormState] = useState(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated) {
      const redirectedFrom = searchParams.get("redirectedFrom") ?? "/";
      router.replace(redirectedFrom);
    }
  }, [isAuthenticated, router, searchParams]);

  // 휴대폰번호 형식 검증 함수
  const validatePhoneNumber = useCallback((phoneNumber: string): boolean => {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(phoneNumber);
  }, []);

  // 폼 검증 함수
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formState.name.trim()) {
      errors.name = "이름을 입력해주세요";
    }

    if (!formState.phoneNumber.trim()) {
      errors.phoneNumber = "휴대폰번호를 입력해주세요";
    } else if (!validatePhoneNumber(formState.phoneNumber)) {
      errors.phoneNumber = "올바른 휴대폰번호 형식이 아닙니다 (010-XXXX-XXXX)";
    }

    if (!formState.agreeToTerms) {
      errors.agreeToTerms = "약관에 동의해야 합니다";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formState.name, formState.phoneNumber, formState.agreeToTerms, validatePhoneNumber]);

  const isSubmitDisabled = useMemo(
    () =>
      !formState.email.trim() ||
      !formState.password.trim() ||
      formState.password !== formState.confirmPassword ||
      !formState.name.trim() ||
      !formState.phoneNumber.trim() ||
      !formState.agreeToTerms,
    [formState.confirmPassword, formState.email, formState.password, formState.name, formState.phoneNumber, formState.agreeToTerms]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      setFormState((previous) => ({ ...previous, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setErrorMessage(null);
      setInfoMessage(null);
      setFieldErrors({});

      // 클라이언트 측 검증
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }

      try {
        // 회원가입 요청 데이터 준비
        const signupData: SignupRequest = {
          email: formState.email,
          password: formState.password,
          role: formState.role,
          name: formState.name,
          phoneNumber: formState.phoneNumber,
          agreeToTerms: formState.agreeToTerms,
        };

        // 새로운 회원가입 API 호출
        const response = await apiClient.POST("/auth/signup", {
          body: signupData,
        });

        if (!response.ok) {
          setErrorMessage(response.error?.message ?? "회원가입에 실패했습니다.");
          setIsSubmitting(false);
          return;
        }

        // 회원가입 성공 처리
        await refresh();
        const redirectPath = getRoleBasedRedirectPath(formState.role);
        setInfoMessage(`회원가입이 완료되었습니다. 로그인 후 ${formState.role === 'learner' ? '코스 카탈로그' : '강사 대시보드'}로 이동합니다.`);
        setFormState(defaultFormState);

        // 잠시 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push("/login");
        }, 2000);

      } catch (error) {
        console.error("Signup error:", error);
        setErrorMessage("회원가입 처리 중 문제가 발생했습니다.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState, validateForm, refresh, router]
  );

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold">회원가입</h1>
        <p className="text-slate-500">
          Supabase 계정으로 회원가입하고 프로젝트를 시작하세요.
        </p>
      </header>
      <div className="grid w-full gap-8 md:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            이메일
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formState.email}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            비밀번호
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              value={formState.password}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            비밀번호 확인
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={formState.confirmPassword}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>

          {/* 역할 선택 */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-slate-700">역할 선택</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value="learner"
                  checked={formState.role === "learner"}
                  onChange={handleChange}
                  className="text-slate-900 focus:ring-slate-500"
                />
                학습자
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value="instructor"
                  checked={formState.role === "instructor"}
                  onChange={handleChange}
                  className="text-slate-900 focus:ring-slate-500"
                />
                강사
              </label>
            </div>
          </fieldset>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            이름
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              value={formState.name}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
            {fieldErrors.name && (
              <p className="text-xs text-rose-500">{fieldErrors.name}</p>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            휴대폰번호
            <input
              type="tel"
              name="phoneNumber"
              autoComplete="tel"
              required
              placeholder="010-1234-5678"
              value={formState.phoneNumber}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
            {fieldErrors.phoneNumber && (
              <p className="text-xs text-rose-500">{fieldErrors.phoneNumber}</p>
            )}
          </label>

          {/* 약관 동의 */}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formState.agreeToTerms}
              onChange={(e) => setFormState(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
              className="mt-0.5 text-slate-900 focus:ring-slate-500"
            />
            <span>
              <Link href="/terms" className="text-slate-900 underline hover:text-slate-700">
                이용약관
              </Link>
              에 동의합니다
            </span>
          </label>
          {fieldErrors.agreeToTerms && (
            <p className="text-xs text-rose-500">{fieldErrors.agreeToTerms}</p>
          )}

          {errorMessage ? (
            <p className="text-sm text-rose-500">{errorMessage}</p>
          ) : null}
          {infoMessage ? (
            <p className="text-sm text-emerald-600">{infoMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting || isSubmitDisabled}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "등록 중" : "회원가입"}
          </button>
          <p className="text-xs text-slate-500">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-slate-700 underline hover:text-slate-900"
            >
              로그인으로 이동
            </Link>
          </p>
        </form>
        <figure className="overflow-hidden rounded-xl border border-slate-200">
          <Image
            src="https://picsum.photos/seed/signup/640/640"
            alt="회원가입"
            width={640}
            height={640}
            className="h-full w-full object-cover"
            priority
          />
        </figure>
      </div>
    </div>
  );
}
