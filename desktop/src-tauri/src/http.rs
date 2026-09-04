use reqwest::{Client, Response};

/// No desktop-side env var convention existed before this — mirrors the frontend's
/// `NEXT_PUBLIC_API_URL` pattern (`frontend/lib/api.ts:1`) with the same localhost default.
pub fn base_url() -> String {
    std::env::var("DJCLOUD_API_URL").unwrap_or_else(|_| "http://localhost:8080".to_string())
}

/// Sends an authenticated GET and returns the raw response, checked for a success status but not
/// yet consumed — callers decide whether to `.json()` it or stream `.bytes_stream()` from it.
pub async fn get(client: &Client, token: &str, path: &str) -> Result<Response, String> {
    let url = format!("{}{}", base_url(), path);
    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|err| format!("Could not reach the server: {err}"))?;

    if response.status().is_success() {
        Ok(response)
    } else {
        Err(format!("{path} returned {}", response.status()))
    }
}

pub async fn get_json<T: serde::de::DeserializeOwned>(
    client: &Client,
    token: &str,
    path: &str,
) -> Result<T, String> {
    get(client, token, path)
        .await?
        .json::<T>()
        .await
        .map_err(|err| format!("Could not parse response from {path}: {err}"))
}
