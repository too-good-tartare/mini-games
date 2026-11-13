# 미니 게임

테트리스, 2048, Fruit Ninja, **틈, 맞춤**을 즐길 수 있는 React 게임 모음입니다.

## 틈, 맞춤

홈에서 ‘틈, 맞춤’을 선택하거나 `/tile-fit`으로 접속합니다. 타일·자를 직접 끌고, 가로폭의 25% 크기인 오른쪽 아래 펜 버튼을 켜 타일 위에 바로 그립니다. 버튼은 플레이 화면 오른쪽 아래에 표시하며, footer는 짧은 안내 높이를 유지합니다. 가이드 없이 자유곡선을 그릴 수 있고, 자·다른 타일 가장자리 근처에서는 선을 맞춰 줍니다. 펜을 끄면 닫힌 조각을 제거하거나 타일을 빈자리에 옮길 수 있습니다. 한 획은 되돌리기 한 번으로 지웁니다. [펜 입력](docs/pen-input.md)을 참고하세요. 벽·줄눈 스냅과 제거 영역 미리보기를 지원합니다.

기본 타일 세 장은 모두 동일하며, 어느 타일이든 재단·본뜨기·자동 맞춤에 사용할 수 있습니다. 겹친 위쪽 타일의 실제 가장자리를 따라 아래 타일에 선을 그을 수 있습니다. 기존 일자 자와 함께 직각삼각형자를 제공하며, 세 변 재단·스냅·손잡이 회전·두 손가락 조작을 지원합니다. 되돌리기는 마지막으로 재단·제거한 타일에 적용됩니다. [세 타일과 삼각자](docs/tile-workbench.md)를 참고하세요.

고정 네 스테이지 대신 매번 새 직각 벽 문제를 생성합니다. 섞기·다음은 새 문제, 다시 시작은 같은 문제를 유지합니다. `/tile-fit?seed=42`로 첫 문제를 재현할 수 있습니다. 생성 시 재단·제거 해법을 독립 검증하고, 아래에서 위로 벽을 통과하지 않고 끼울 수 있는 문제만 제공합니다. 제한된 재시도 뒤에는 검증된 기본 문제를 사용합니다. 증명 범위와 구현은 [생성 문서](docs/certified-generation.md)를 참조하세요.

게임은 `public/games/tile-fit/index.html`과 인접한 `tile-engine.js`로 구성되며, 별도로 브라우저에서 열어도 실행됩니다. `src/games/tileFit`에서 iframe으로 연결하고 seed 쿼리를 전달합니다. 모바일에서는 메뉴 아래의 남은 화면을 사용합니다. 타일은 벽을 통과할 수 없으며, 화면 밖으로 일부 옮겨도 다시 잡을 부분이 남습니다. 너무 작은 화면에서는 충분한 세로 공간이 생길 때까지 플레이를 멈춥니다.

추가 설치 없이 검사를 실행합니다.

```
node tests/tile-fit-generation.cjs
node tests/tile-fit.cjs
```

생성 검사에는 1,024개 seed, 독립 해법 재생과 전체 삽입 경로가 포함됩니다. 입력 검사는 여러 화면 크기에서 자·펜·조각·타일을 조작하고 벽 충돌·자동 맞춤·시작 연출·스냅·미리보기·초기화·화면 크기 변경을 확인합니다. DOM·캔버스는 모의 객체이며 이번 변경의 새 브라우저 시각 검증은 수행하지 못했습니다.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
