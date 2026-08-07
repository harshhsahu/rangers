import jwt from "jsonwebtoken";

/**
 * Embed-style JWT:
 * { org_id: env ORG_ID, folder_id: env FOLDER_ID, user_id: current user's org id }
 * Signed with ACCESS_KEY (HS256).
 */
export function signInternalJwt({ userOrgId }) {
  const accessKey = process.env.ACCESS_KEY;
  if (!accessKey) throw new Error("ACCESS_KEY is not configured");
  if (!process.env.ORG_ID) throw new Error("ORG_ID is not configured");
  if (!process.env.FOLDER_ID) throw new Error("FOLDER_ID is not configured");

  const payload = {
    org_id: String(process.env.ORG_ID),
    folder_id: String(process.env.FOLDER_ID),
    user_id: String(userOrgId || ""),
  };

  return jwt.sign(payload, accessKey, { algorithm: "HS256" });
}

export function verifyInternalJwt(token) {
  const accessKey = process.env.ACCESS_KEY;
  if (!accessKey || !token) return null;

  try {
    return jwt.verify(token, accessKey, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}
