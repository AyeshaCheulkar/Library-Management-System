const BASE_URL =
  process.env.REACT_APP_API_URL ||
  (window.location.port === "3000" ? "http://localhost:4000" : "");

let accessToken = null;
let onSessionLost = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function onUnauthenticated(handler) {
  onSessionLost = handler;
}

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get fieldErrors() {
    return this.details?.fields ?? {};
  }
}

async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
  }

  return new ApiError({
    status: response.status,
    code: body?.error?.code ?? "INTERNAL",
    message: body?.error?.message ?? "Something went wrong. Please try again.",
    details: body?.error?.details,
    requestId: body?.error?.requestId ?? response.headers.get("X-Request-Id"),
  });
}

function send(path, options = {}) {
  const hasBody = options.body !== undefined;

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
}

let refreshInFlight = null;

function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = send("/api/auth/refresh", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) throw await toApiError(response);
        const body = await response.json();
        setAccessToken(body.data.accessToken);
        return body.data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function request(path, options = {}, { allowRetry = true } = {}) {
  let response = await send(path, options);

  if (response.status === 401 && allowRetry) {
    try {
      await refreshOnce();
    } catch {
      onSessionLost();
      throw await toApiError(response);
    }
    response = await send(path, options);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return null;

  const body = await response.json();
  return body.data;
}

export const get = (path) => request(path);
export const post = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const patch = (path, body) =>
  request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
export const del = (path) => request(path, { method: "DELETE" });

export function refreshSession() {
  return refreshOnce();
}
