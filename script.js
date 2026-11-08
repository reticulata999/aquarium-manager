
// ==================================
// Supabase接続設定
// ==================================

const SUPABASE_URL = "https://pxvdsarepglyfrvnzgzu.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWisvWLBqGWYQ6emlFzoWg_k7SgQ2xQ";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ==================================
// アプリの基本設定
// ==================================

let tanks = [];
let history = [];
let currentUser = null;

// ==================================
// ログイン状態の管理
// ==================================

async function handleSession(session) {
  currentUser = session?.user ?? null;

  const authPanel = document.getElementById("authPanel");
  const appPanel = document.getElementById("appPanel");

  if (currentUser) {
    authPanel.hidden = true;
    appPanel.hidden = false;

    await loadData();
  } else {
    authPanel.hidden = false;
    appPanel.hidden = true;

    tanks = [];
    history = [];
  }
}

// ログイン状態の変化を監視
supabaseClient.auth.onAuthStateChange(
  function(event, session) {
    handleSession(session).catch(function(error) {
      console.error(error);
    });
  }
);

// 最初のログイン状態を確認
supabaseClient.auth.getSession().then(function(result) {
  handleSession(result.data.session);
});

// ==================================
// ログイン
// ==================================

document.getElementById("authForm").addEventListener(
  "submit",
  async function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("authMessage");

    message.textContent = "ログイン中...";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      message.textContent = "ログインエラー：" + error.message;
    } else {
      message.textContent = "";
    }
  }
);

// ==================================
// 新規登録
// ==================================

document.getElementById("signUpButton").addEventListener(
  "click",
  async function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("authMessage");

    if (!email || password.length < 6) {
      message.textContent =
        "メールアドレスと6文字以上のパスワードを入力してください。";
      return;
    }

    message.textContent = "登録中...";

    const { error } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (error) {
      message.textContent = "登録エラー：" + error.message;
    } else {
      message.textContent = "登録しました。ログインしてください。";
    }
  }
);

// ==================================
// ログアウト
// ==================================

document.getElementById("logoutButton").addEventListener(
  "click",
  async function() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      alert("ログアウトエラー：" + error.message);
    }
  }
);

// ==================================
// データ読み込み
// ==================================

async function loadData() {
  if (!currentUser) return;

  const tankResult = await supabaseClient
    .from("tanks")
    .select("*")
    .order("created_at", { ascending: true });

  if (tankResult.error) {
    throw tankResult.error;
  }

  const historyResult = await supabaseClient
    .from("water_change_logs")
    .select("*")
    .order("changed_at", { ascending: false });

  if (historyResult.error) {
    throw historyResult.error;
  }

  tanks = tankResult.data;
  history = historyResult.data;

  render();
await loadTankContents();
}

// ==================================
// 画面表示
// ==================================

function render() {
  const tankList = document.getElementById("tankList");
  const historyList = document.getElementById("historyList");

  tankList.replaceChildren();
  historyList.replaceChildren();

  // 水槽一覧
  if (tanks.length === 0) {
    tankList.textContent = "まだ水槽が登録されていません。";
  }

  tanks.forEach(function(tank) {
    const card = document.createElement("div");
    card.className = "tank-card";
    card.dataset.tankId = tank.id;

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

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      const amount = Number(input.value);

      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (amount > Number(tank.volume)) {
        alert("換水量が水槽の水量を超えています。");
        return;
      }

      button.disabled = true;

      const { error } = await supabaseClient
        .from("water_change_logs")
        .insert({
          tank_id: tank.id,
          user_id: currentUser.id,
          amount: amount
        });

      if (error) {
        alert("記録エラー：" + error.message);
      } else {
        await loadData();
      }

      button.disabled = false;
    });

    card.append(title, volume, form);
    tankList.appendChild(card);
  });

  // 水換え履歴
  if (history.length === 0) {
    historyList.textContent = "まだ履歴はありません。";
    return;
  }

  history.forEach(function(record) {
    const item = document.createElement("div");
    item.className = "history-item";

    const tank = tanks.find(function(tank) {
      return tank.id === record.tank_id;
    });

    const date = new Date(record.changed_at).toLocaleString("ja-JP");

    item.textContent =
      date + "｜" +
      (tank ? tank.name : "不明な水槽") + "｜" +
      record.amount + " L 換水";

    historyList.appendChild(item);
  });
}

// ==================================
// 水槽登録
// ==================================

document.getElementById("tankForm").addEventListener(
  "submit",
  async function(event) {
    event.preventDefault();

    if (!currentUser) return;

    const name = document.getElementById("tankName").value.trim();

    const volume = Number(
      document.getElementById("tankVolume").value
    );

    if (!name || !Number.isFinite(volume) || volume <= 0) {
      return;
    }

    const button = event.target.querySelector("button");
    button.disabled = true;

    const { error } = await supabaseClient
      .from("tanks")
      .insert({
        user_id: currentUser.id,
        name: name,
        volume: volume
      });

    if (error) {
      alert("登録エラー：" + error.message);
    } else {
      event.target.reset();
      await loadData();
    }

    button.disabled = false;
  }
);


// ==================================
// 水槽内の構成管理
// ==================================

let tankContents = [];

// 構成データ読み込み
async function loadTankContents() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("tank_contents")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("構成読み込みエラー:", error);
    return;
  }

  tankContents = data || [];
  renderTankContents();
}

// 構成データ表示
function renderTankContents() {
  tanks.forEach(function(tank) {
    const card = Array.from(
      document.querySelectorAll(".tank-card")
    ).find(function(element) {
      return element.dataset.tankId === tank.id;
    });

    if (!card) return;

    let section = card.querySelector(".contents-section");

    if (!section) {
      section = document.createElement("div");
      section.className = "contents-section";
      card.appendChild(section);
    }

    section.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "水槽内の構成";

    section.appendChild(heading);

    const contents = tankContents.filter(function(item) {
      return item.tank_id === tank.id;
    });

    if (contents.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "まだ登録されていません。";
      section.appendChild(empty);
    }

    contents.forEach(function(item) {
      const row = document.createElement("div");

      const text = document.createElement("p");
      text.textContent =
        item.category + "｜" +
        item.name + " × " +
        item.quantity +
        (item.memo ? "｜" + item.memo : "");

      const editButton = document.createElement("button");
editButton.type = "button";
editButton.textContent = "編集";

editButton.addEventListener("click", async function() {
  const newName = prompt("名前を入力してください", item.name);
  if (newName === null) return;

  const trimmedName = newName.trim();
  if (!trimmedName) {
    alert("名前を入力してください。");
    return;
  }

  const newQuantity = prompt("数量を入力してください", item.quantity);
  if (newQuantity === null) return;

  const count = Number(newQuantity);
  if (!Number.isInteger(count) || count < 1) {
    alert("数量は1以上の整数にしてください。");
    return;
  }

  const newMemo = prompt("メモを入力してください", item.memo || "");
  if (newMemo === null) return;

  const { error } = await supabaseClient
    .from("tank_contents")
    .update({
      name: trimmedName,
      quantity: count,
      memo: newMemo.trim()
    })
    .eq("id", item.id);

  if (error) {
    alert("編集エラー：" + error.message);
    return;
  }

  await loadTankContents();
});

        const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "削除";

      deleteButton.addEventListener("click", async function() {
        if (!confirm(item.name + "を削除しますか？")) return;

        const { error } = await supabaseClient
          .from("tank_contents")
          .delete()
          .eq("id", item.id);

        if (error) {
          alert("削除エラー：" + error.message);
          return;
        }

        await loadTankContents();
      });

      row.append(text, editButton, deleteButton);
      section.appendChild(row);
    });

    // 登録フォーム
    const form = document.createElement("form");

    const category = document.createElement("select");

    ["生体", "水草", "機材", "底床・その他"].forEach(function(value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      category.appendChild(option);
    });

    const name = document.createElement("input");
    name.placeholder = "名前";
    name.required = true;

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.step = "1";
    quantity.value = "1";
    quantity.required = true;

    const memo = document.createElement("input");
    memo.placeholder = "メモ（任意）";

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "構成を追加";

    form.append(category, name, quantity, memo, button);

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      const count = Number(quantity.value);

      if (!Number.isInteger(count) || count < 1) {
        alert("数量は1以上の整数で入力してください。");
        return;
      }

      button.disabled = true;

      const { error } = await supabaseClient
        .from("tank_contents")
        .insert({
          tank_id: tank.id,
          user_id: currentUser.id,
          category: category.value,
          name: name.value.trim(),
          quantity: count,
          memo: memo.value.trim()
        });

      if (error) {
        alert("登録エラー：" + error.message);
      } else {
        await loadTankContents();
      }

      button.disabled = false;
    });

    section.appendChild(form);
  });
}
