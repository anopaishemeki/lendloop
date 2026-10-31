// Settings come from n8n Variables; self-hosted community installs without
// Variables fall back to environment variables of the same name.
function setting(name) {
  try {
    return $vars?.[name] || $env[name];
  } catch {
    // Env access is blocked and there is no Variable: treat as unset.
  }
}
function required(name) {
  const value = setting(name);
  if (!value) {
    throw new Error(
      `${name} is not set (n8n Variable or environment variable)`
    );
  }
  return value;
}
