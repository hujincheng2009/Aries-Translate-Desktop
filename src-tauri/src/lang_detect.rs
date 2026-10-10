use lingua::{Language, LanguageDetector, LanguageDetectorBuilder};
use std::sync::OnceLock;

const LANGUAGES: &[(Language, &str)] = &[
    (Language::Chinese, "zh_cn"),
    (Language::Japanese, "ja"),
    (Language::English, "en"),
    (Language::Korean, "ko"),
    (Language::French, "fr"),
    (Language::Spanish, "es"),
    (Language::German, "de"),
    (Language::Russian, "ru"),
    (Language::Italian, "it"),
    (Language::Portuguese, "pt_pt"),
    (Language::Turkish, "tr"),
    (Language::Arabic, "ar"),
    (Language::Vietnamese, "vi"),
    (Language::Thai, "th"),
    (Language::Indonesian, "id"),
    (Language::Malay, "ms"),
    (Language::Hindi, "hi"),
    (Language::Mongolian, "mn_cy"),
    (Language::Bokmal, "nb_no"),
    (Language::Nynorsk, "nn_no"),
    (Language::Persian, "fa"),
    (Language::Ukrainian, "uk"),
    (Language::Polish, "pl"),
    (Language::Dutch, "nl"),
    (Language::Swedish, "sv"),
    (Language::Hebrew, "he"),
];

fn detector() -> &'static LanguageDetector {
    static DETECTOR: OnceLock<LanguageDetector> = OnceLock::new();
    DETECTOR.get_or_init(|| {
        let languages: Vec<_> = LANGUAGES.iter().map(|(language, _)| *language).collect();
        LanguageDetectorBuilder::from_languages(&languages)
            .with_minimum_relative_distance(0.1)
            .build()
    })
}

pub fn init_lang_detect() {
    let _ = detector().detect_language_of("Hello Language");
}

#[tauri::command]
pub fn lang_detect(text: &str) -> Result<&'static str, ()> {
    if !text.chars().any(char::is_alphabetic) {
        return Ok("auto");
    }
    let language = detector().detect_language_of(text);
    Ok(LANGUAGES
        .iter()
        .find(|(candidate, _)| Some(*candidate) == language)
        .map(|(_, code)| *code)
        .unwrap_or("auto"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_previously_missing_languages() {
        for (text, expected) in [
            (
                "To jest przykładowe zdanie napisane w języku polskim.",
                "pl",
            ),
            (
                "Dit is een voorbeeldzin die in het Nederlands is geschreven.",
                "nl",
            ),
            (
                "Det här är en exempelmening som är skriven på svenska.",
                "sv",
            ),
            ("זהו משפט לדוגמה שנכתב בשפה העברית", "he"),
            ("Це приклад речення, написаного українською мовою.", "uk"),
            ("This is an example sentence written in English.", "en"),
        ] {
            assert_eq!(lang_detect(text), Ok(expected), "{text}");
        }
    }

    #[test]
    fn does_not_invent_english_for_non_language_input() {
        for text in ["", "  ", "12345", "!? 😊"] {
            assert_eq!(lang_detect(text), Ok("auto"));
        }
    }
}
