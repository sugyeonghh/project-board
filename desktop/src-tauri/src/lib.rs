// 앱 로직은 대부분 React(src/)에 있고, 여기서는 창과 플러그인만 설정한다.
// - dialog: 첨부파일 "다른 이름으로 저장" 창
// - fs: 고른 위치에 파일 쓰기
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("프로젝트 보드를 실행하지 못했습니다");
}
