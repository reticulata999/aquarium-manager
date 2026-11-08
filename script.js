
// 保存データを読み込む
let tanks = JSON.parse(
  localStorage.getItem("aquariumTanks") || "[]"
);

let history = JSON.parse(
  localStorage.getItem("aquariumHistory") || "[]"
);

// データを保存する関数
function saveData() {
  localStorage.setItem("aquariumTanks", JSON.stringify(tanks));
  localStorage.setItem("aquariumHistory", JSON.stringify(history));
}

// 画面を更新する関数
function render() {
  const tankList = document.getElementById("tankList");
  const historyList = document.getElementById("historyList");

  tankList.replaceChildren();
  historyList.replaceChildren();

  // 水槽一覧を表示
  if (tanks.length === 0) {
    tankList.textContent = "まだ水槽が登録されていません。";
  }

  tanks.forEach(function(tank) {
    const card = document.createElement("div");
    card.className = "tank-card";

    const title = document.createElement("h3");
    title.textContent = tank.name;

    const volume = document.createElement("p");
    volume.textContent = "水量：約 " + tank.volume + " L";

    const form = document.createElement("form");
    form.className = "water-form";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.1";
    input.step = "0.1";
    input.placeholder = "換水量(L)";
    input.required = true;

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "水換えを記録";

    form.append(input, button);

    form.addEventListener("submit", function(event) {
      event.preventDefault();

      const amount = Number(input.value);

      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (amount > Number(tank.volume)) {
        alert("換水量が水槽の水量を超えています。");
        return;
      }

      history.unshift({
        tankName: tank.name,
        amount: amount,
        date: new Date().toLocaleString("ja-JP")
      });

      saveData();
      render();
    });

    card.append(title, volume, form);
    tankList.appendChild(card);
  });

  // 水換え履歴を表示
  if (history.length === 0) {
    historyList.textContent = "まだ履歴はありません。";
    return;
  }

  history.forEach(function(record) {
    const item = document.createElement("div");
    item.className = "history-item";

    item.textContent =
      record.date + "｜" +
      record.tankName + "｜" +
      record.amount + " L 換水";

    historyList.appendChild(item);
  });
}

// 水槽を登録する
document.getElementById("tankForm").addEventListener(
  "submit",
  function(event) {
    event.preventDefault();

    const name = document.getElementById("tankName").value.trim();
    const volume = Number(
      document.getElementById("tankVolume").value
    );

    if (!name || !Number.isFinite(volume) || volume <= 0) {
      return;
    }

    tanks.push({
      id: Date.now(),
      name: name,
      volume: volume
    });

    saveData();
    render();

    event.target.reset();
  }
);

// 最初の画面を表示
render();
