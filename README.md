# kingshot-kor-map

[Kingshot Mapper](https://ksmapper.pages.dev)의 정적 사본에 왕국 #2382 KOR 연맹 깃발 배치를 기본 레이아웃으로 넣은 버전입니다.

## 실행

정적 파일이므로 아무 웹 서버로 열면 됩니다.

```sh
python -m http.server 8000
# http://localhost:8000/
```

## KOR 깃발 배치 (`kor-layout.js`)

- 금색: 게임 좌표로 확인된 본진 깃발 22개
- 하늘색: 게임 스크린샷(2026-09-29)의 KOR 영토를 7×7 단위로 분해해 추정한 깃발 235개 (위치 오차 약 ±4칸)

브라우저에 저장된 작업본이 없을 때 자동으로 불러오며, `?kor=reset`으로 다시 불러올 수 있습니다.
본부(HQ) 위치가 확인되지 않아 깃발 이름은 기본값 `Banner`로 두었습니다.

## 출처

지도·편집기 코드와 데이터: [ksmapper.pages.dev](https://ksmapper.pages.dev) (Kingshot Mapper).
클라우드 공유·템플릿 기능은 원본 서버를 사용하므로 다른 주소에서는 동작하지 않을 수 있습니다.
