# React-експорт: екран привітання + екран входу

Два готових презентаційних компоненти, портовані 1-в-1 з дизайну (Welcome.dc.html).

## Файли
- `WelcomeScreen.jsx` — екран привітання
- `LoginScreen.jsx` — екран входу (вкладки Вхід/Реєстрація через `useState`)
- `MainScreen.jsx` — головний екран (топ-бар + нижня навігація + сцена вежі)
- `TowerScene.jsx` — сцена з поверхами; дані поверхів у масиві `FLOORS` (редагуй вільно)
- `Production.jsx` — картка виробництва (стани: buy / delivery / layout / sell / collect / hire)
- `welcome-bg.png` — фон міста, `img/*.png` — зображення товарів

### Дерево головного екрана
`MainScreen` → `TowerScene` → `Production` (×9). Усі пропси типізовані в коментарях.

## Як підключити

1. **Скопіюй** усі три файли у свій проєкт (напр. `src/screens/`).

2. **Шрифти** — додай у `index.html` (або через `@import` у CSS):
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
   ```

3. **Розмір.** Компоненти заповнюють батьківський контейнер (`width/height: 100%`)
   і позиціонуються `absolute` всередині нього. Загорни в контейнер з потрібним
   розміром — на весь екран або у рамці телефона:
   ```jsx
   <div style={{ position: "relative", width: "100%", height: "100vh" }}>
     <WelcomeScreen onPlay={...} onLogin={...} onRegister={...} />
   </div>
   ```

4. **Обробники** передаються пропсами:
   - `WelcomeScreen`: `onPlay`, `onLogin`, `onRegister`
   - `LoginScreen`: `onSubmit`, `onGoogle`, `onApple`

## Нотатки
- Стилі — inline-обʼєкти, жодних CSS-файлів не треба. Дефісні властивості
  стали camelCase (`border-radius` → `borderRadius`, `-webkit-text-stroke` → `WebkitTextStroke`).
- Інпути зараз неконтрольовані — додай `value`/`onChange` за потреби.
- Іконка Google — справжній 4-кольоровий SVG. Монета/ромб/поверхи намальовані CSS.
- Якщо це **React Native**, а не web: цей код web-орієнтований (градієнти,
  `backdrop-filter`, `box-shadow`). Для RN знадобиться переписати на
  `View`/`Text`/`Image` + `expo-linear-gradient`; скажи — зроблю окремий варіант.
