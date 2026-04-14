const API_URL = "http://localhost:4000";

export async function loginAs(
  email: string,
  password = "QaMetrics2024!"
): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const data = await res.json();
  return data.accessToken;
}

export { API_URL };
