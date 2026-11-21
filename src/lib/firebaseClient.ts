// 브라우저의 주인 로그인(Firebase Auth, Google). 대화창을 열 때만 SDK를 불러온다.
import type { Auth, User } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain:
    (import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    (import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ? `${import.meta.env.PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : undefined),
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID as string | undefined,
};

/** 빌드에 Firebase 웹 설정이 들어 있는지 */
export const firebaseEnabled = !!(config.apiKey && config.projectId);

let authPromise: Promise<Auth> | null = null;
export function getAuthLazy(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = getApps()[0] ?? initializeApp(config);
    const auth = getAuth(app);
    await auth.authStateReady();
    return auth;
  })();
  return authPromise;
}

export async function currentUser(): Promise<User | null> {
  return firebaseEnabled ? (await getAuthLazy()).currentUser : null;
}

export async function signIn(): Promise<User> {
  const auth = await getAuthLazy();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}

export async function signOut(): Promise<void> {
  await (await getAuthLazy()).signOut();
}

/** 서버 API용 ID 토큰(만료가 가까우면 SDK가 새로 받는다). 로그인 안 했으면 오류 */
export async function idToken(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error('로그인이 필요해요.');
  return user.getIdToken();
}
