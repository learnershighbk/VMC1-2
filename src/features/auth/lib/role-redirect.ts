import { UserRole } from "../types";

/**
 * 역할 기반 리다이렉션 경로를 반환하는 함수
 */
export function getRoleBasedRedirectPath(role: UserRole): string {
  switch (role) {
    case "learner":
      return "/courses";
    case "instructor":
      return "/instructor/dashboard";
    default:
      return "/";
  }
}

/**
 * 사용자 역할에 따른 홈페이지 경로를 반환하는 함수
 */
export function getRoleBasedHomePath(role: UserRole): string {
  return getRoleBasedRedirectPath(role);
}
