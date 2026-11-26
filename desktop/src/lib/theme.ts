import { useEffect, useState } from "react";

/** 화면 테마. system이면 윈도우의 밝게/어둡게 설정을 따른다. PC마다 따로 기억한다. */
export type ThemePref = "light" | "dark" | "system";

const KEY = "pm.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** 앱 시작 때 한 번 호출. 저장된 테마를 적용하고, 시스템 테마가 바뀌면 따라간다. */
export function initTheme() {
  apply(getThemePref());
  media().addEventListener("change", () => apply(getThemePref()));
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    if (pref === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
    apply(pref);
  }, [pref]);
  return [pref, setPref];
}
