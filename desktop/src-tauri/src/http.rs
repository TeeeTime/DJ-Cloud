use reqwest::{Client, Response};

/// Read at compile time (not `std::env::var`, which would look for `DJCLOUD_API_URL` in the
/// *running* user's environment, where it will never be set) so the release workflow can bake
/// the production URL into the binary while `cargo tauri dev` keeps defaulting to localhost.
pub fn base_url() -> String {
    option_env!("DJCLOUD_API_URL")
        .unwrap_or("http://localhost:8080")
        .to_string()
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
