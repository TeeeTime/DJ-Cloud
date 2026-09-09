fn main() {
    println!("cargo:rerun-if-env-changed=DJCLOUD_API_URL");
    tauri_build::build()
}
