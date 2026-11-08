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
let tankContents = [];
let tankPhotos = [];
let tankContentLogs = [];
let currentUser = null;


// ==================================
// 共通処理
// ==================================

// 水槽カードを取得
function getTankCard(tankId) {
  return Array.from(
    document.querySelectorAll(".tank-card")
  ).find(function(card) {
    return card.dataset.tankId === tankId;
  });
}


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
    tankContents = [];
    tankPhotos = [];
    tankContentLogs = [];
  }
}


// ログイン状態の変化を監視
supabaseClient.auth.onAuthStateChange(
  function(event, session) {
    handleSession(session).catch(function(error) {
      console.error("ログイン状態の処理エラー:", error);
    });
  }
);


// 最初のログイン状態を確認
supabaseClient.auth.getSession().then(function(result) {
  handleSession(result.data.session).catch(function(error) {
    console.error("初期ログイン確認エラー:", error);
  });
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

  // 水槽データ
  const tankResult = await supabaseClient
    .from("tanks")
    .select("*")
    .order("created_at", { ascending: true });

  if (tankResult.error) {
    throw tankResult.error;
  }

  // 水換え履歴
  const historyResult = await supabaseClient
    .from("water_change_logs")
    .select("*")
    .order("changed_at", { ascending: false });

  if (historyResult.error) {
    throw historyResult.error;
  }

  tanks = tankResult.data || [];
  history = historyResult.data || [];

  // 基本画面を表示
  render();

  // 関連データを読み込み
  await loadTankContents();
  await loadTankPhotos();
  await loadTankContentLogs();
}


// ==================================
// 画面表示
// ==================================

function render() {
  const tankList = document.getElementById("tankList");
  const historyList = document.getElementById("historyList");

  tankList.replaceChildren();
  historyList.replaceChildren();


  // ----------------------------------
  // 水槽一覧
  // ----------------------------------

  if (tanks.length === 0) {
    tankList.textContent = "まだ水槽が登録されていません。";
  }

  tanks.forEach(function(tank) {
    const card = document.createElement("div");

    card.className = "tank-card";
    card.dataset.tankId = tank.id;

    // 水槽名
    const title = document.createElement("h3");
    title.textContent = tank.name;

    // 水量
    const volume = document.createElement("p");
    volume.textContent = "水量：約 " + tank.volume + " L";


    // ----------------------------------
    // 水換えフォーム
    // ----------------------------------

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


    // ----------------------------------
    // 水換え記録処理
    // ----------------------------------

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      const amount = Number(input.value);

      if (!Number.isFinite(amount) || amount <= 0) {
        alert("正しい換水量を入力してください。");
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
        button.disabled = false;
        return;
      }

      await loadData();
    });


    card.append(title, volume, form);
    tankList.appendChild(card);
  });


  // ----------------------------------
  // 水換え履歴
  // ----------------------------------

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
      alert("水槽名と正しい水量を入力してください。");
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
      button.disabled = false;
      return;
    }

    event.target.reset();

    await loadData();
  }
);


// ==================================
// 水槽内の構成管理
// ==================================


// ----------------------------------
// 構成データ読み込み
// ----------------------------------

async function loadTankContents() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("tank_contents")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("構成読み込みエラー:", error);
    alert("構成データの読み込みに失敗しました。");
    return;
  }

  tankContents = data || [];

  renderTankContents();
}


// ----------------------------------
// 構成データ表示
// ----------------------------------

function renderTankContents() {
  tanks.forEach(function(tank) {
    const card = getTankCard(tank.id);

    if (!card) return;

    // 構成表示エリア
    let section = card.querySelector(".contents-section");

    if (!section) {
      section = document.createElement("div");
      section.className = "contents-section";
      card.appendChild(section);
    }

    section.replaceChildren();

    // 見出し
    const heading = document.createElement("h4");
    heading.textContent = "水槽内の構成";

    section.appendChild(heading);

    // この水槽の構成だけ取得
    const contents = tankContents.filter(function(item) {
      return item.tank_id === tank.id;
    });

    // 登録データがない場合
    if (contents.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "まだ登録されていません。";

      section.appendChild(empty);
    }


    // ----------------------------------
    // 登録済み構成
    // ----------------------------------

    contents.forEach(function(item) {
      const row = document.createElement("div");

      const text = document.createElement("p");

      text.textContent =
        item.category + "｜" +
        item.name + " × " +
        item.quantity +
        (item.memo ? "｜" + item.memo : "");


      // ----------------------------------
      // 編集ボタン
      // ----------------------------------

      const editButton = document.createElement("button");

      editButton.type = "button";
      editButton.textContent = "編集";

      editButton.addEventListener("click", async function() {

        // 名前
        const newName = prompt(
          "名前を入力してください",
          item.name
        );

        if (newName === null) return;

        const trimmedName = newName.trim();

        if (!trimmedName) {
          alert("名前を入力してください。");
          return;
        }

        // 数量
        const newQuantity = prompt(
          "数量を入力してください",
          item.quantity
        );

        if (newQuantity === null) return;

        const count = Number(newQuantity);

        if (!Number.isInteger(count) || count < 1) {
          alert("数量は1以上の整数にしてください。");
          return;
        }

        // メモ
        const newMemo = prompt(
          "メモを入力してください",
          item.memo || ""
        );

        if (newMemo === null) return;

        const trimmedMemo = newMemo.trim();

        // データ更新
        const { error } = await supabaseClient
          .from("tank_contents")
          .update({
            name: trimmedName,
            quantity: count,
            memo: trimmedMemo
          })
          .eq("id", item.id)
          .eq("user_id", currentUser.id);

        if (error) {
          alert("編集エラー：" + error.message);
          return;
        }

        // 変更履歴を保存
        await saveTankContentLog({
          tank_id: tank.id,
          action: "編集",
          category: item.category,

          old_name: item.name,
          new_name: trimmedName,

          old_quantity: item.quantity,
          new_quantity: count,

          old_memo: item.memo || "",
          new_memo: trimmedMemo
        });

        await loadTankContents();
      });


      // ----------------------------------
      // 削除ボタン
      // ----------------------------------

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.textContent = "削除";

      deleteButton.addEventListener("click", async function() {

        if (!confirm(item.name + "を削除しますか？")) {
          return;
        }

        const { error } = await supabaseClient
          .from("tank_contents")
          .delete()
          .eq("id", item.id)
          .eq("user_id", currentUser.id);

        if (error) {
          alert("削除エラー：" + error.message);
          return;
        }

        // 変更履歴を保存
        await saveTankContentLog({
          tank_id: tank.id,
          action: "削除",
          category: item.category,

          old_name: item.name,
          old_quantity: item.quantity,
          old_memo: item.memo || ""
        });

        await loadTankContents();
      });


      row.append(text, editButton, deleteButton);
      section.appendChild(row);
    });


    // ----------------------------------
    // 構成登録フォーム
    // ----------------------------------

    const form = document.createElement("form");

    // カテゴリ
    const category = document.createElement("select");

    ["生体", "水草", "機材", "底床・その他"].forEach(
      function(value) {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        category.appendChild(option);
      }
    );

    // 名前
    const name = document.createElement("input");

    name.placeholder = "名前";
    name.required = true;

    // 数量
    const quantity = document.createElement("input");

    quantity.type = "number";
    quantity.min = "1";
    quantity.step = "1";
    quantity.value = "1";
    quantity.required = true;

    // メモ
    const memo = document.createElement("input");

    memo.placeholder = "メモ（任意）";

    // 登録ボタン
    const button = document.createElement("button");

    button.type = "submit";
    button.textContent = "構成を追加";

    form.append(category, name, quantity, memo, button);


    // ----------------------------------
    // 構成登録処理
    // ----------------------------------

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      const itemName = name.value.trim();
      const count = Number(quantity.value);
      const itemMemo = memo.value.trim();

      if (!itemName) {
        alert("名前を入力してください。");
        return;
      }

      if (!Number.isInteger(count) || count < 1) {
        alert("数量は1以上の整数にしてください。");
        return;
      }

      button.disabled = true;

      const { error } = await supabaseClient
        .from("tank_contents")
        .insert({
          tank_id: tank.id,
          user_id: currentUser.id,
          category: category.value,
          name: itemName,
          quantity: count,
          memo: itemMemo
        });

      if (error) {
        alert("登録エラー：" + error.message);
        button.disabled = false;
        return;
      }

      // 変更履歴を保存
      await saveTankContentLog({
        tank_id: tank.id,
        action: "追加",
        category: category.value,

        new_name: itemName,
        new_quantity: count,
        new_memo: itemMemo
      });

      await loadTankContents();
    });

    section.appendChild(form);
  });
}


// ==================================
// 水槽写真管理
// ==================================


// ----------------------------------
// 写真データ読み込み
// ----------------------------------

async function loadTankPhotos() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("tank_photos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("写真読み込みエラー:", error);
    alert("写真データの読み込みに失敗しました。");
    return;
  }

  tankPhotos = data || [];

  await renderTankPhotos();
}


// ----------------------------------
// 写真表示
// ----------------------------------

async function renderTankPhotos() {
  for (const tank of tanks) {
    const card = getTankCard(tank.id);

    if (!card) continue;

    // 写真表示エリア
    let section = card.querySelector(".photos-section");

    if (!section) {
      section = document.createElement("div");
      section.className = "photos-section";
      card.appendChild(section);
    }

    section.replaceChildren();

    // 見出し
    const heading = document.createElement("h4");
    heading.textContent = "水槽写真";

    section.appendChild(heading);

    // この水槽の写真だけ取得
    const photos = tankPhotos.filter(function(photo) {
      return photo.tank_id === tank.id;
    });

    if (photos.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "まだ写真はありません。";

      section.appendChild(empty);
    }


    // ----------------------------------
    // 写真一覧
    // ----------------------------------

    for (const photo of photos) {
      const photoItem = document.createElement("div");

      photoItem.style.marginBottom = "15px";

      // 非公開写真の一時URLを取得
      const { data, error } = await supabaseClient
        .storage
        .from("tank-photos")
        .createSignedUrl(photo.storage_path, 3600);

      if (error) {
        console.error("写真URL取得エラー:", error);
        continue;
      }

      // 写真
      const image = document.createElement("img");

      image.src = data.signedUrl;
      image.alt = tank.name + "の写真";
      image.style.width = "100%";
      image.style.maxWidth = "400px";
      image.style.height = "auto";
      image.style.display = "block";
      image.style.borderRadius = "8px";

      // 登録日時
      const date = document.createElement("p");

      date.textContent = new Date(
        photo.created_at
      ).toLocaleString("ja-JP");


      // ----------------------------------
      // 写真削除ボタン
      // ----------------------------------

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.textContent = "写真を削除";

      deleteButton.addEventListener("click", async function() {

        if (!confirm("この写真を削除しますか？")) {
          return;
        }

        deleteButton.disabled = true;

        // Storageから写真を削除
        const { error: storageError } = await supabaseClient
          .storage
          .from("tank-photos")
          .remove([photo.storage_path]);

        if (storageError) {
          alert("写真削除エラー：" + storageError.message);
          deleteButton.disabled = false;
          return;
        }

        // データベースから情報を削除
        const { error: dbError } = await supabaseClient
          .from("tank_photos")
          .delete()
          .eq("id", photo.id)
          .eq("user_id", currentUser.id);

        if (dbError) {
          alert("写真情報の削除エラー：" + dbError.message);
          return;
        }

        await loadTankPhotos();
      });

      photoItem.append(image, date, deleteButton);
      section.appendChild(photoItem);
    }


    // ----------------------------------
    // 写真登録フォーム
    // ----------------------------------

    const form = document.createElement("form");

    const fileInput = document.createElement("input");

    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.required = true;

    const uploadButton = document.createElement("button");

    uploadButton.type = "submit";
    uploadButton.textContent = "写真を登録";

    form.append(fileInput, uploadButton);


    // ----------------------------------
    // 写真アップロード処理
    // ----------------------------------

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      const files = Array.from(fileInput.files);

      if (files.length === 0) {
        alert("写真を選択してください。");
        return;
      }

      uploadButton.disabled = true;

      let successCount = 0;
      const errors = [];

      for (const file of files) {

        // 画像ファイルか確認
        if (!file.type.startsWith("image/")) {
          errors.push(file.name + "：画像ファイルではありません。");
          continue;
        }

        // 10MB制限
        if (file.size > 10 * 1024 * 1024) {
          errors.push(file.name + "：10MBを超えています。");
          continue;
        }

        // ファイル拡張子
        let extension = file.name.split(".").pop().toLowerCase();

        if (!/^[a-z0-9]+$/.test(extension)) {
          extension = "jpg";
        }

        // 保存先のパス
        const filePath =
          currentUser.id + "/" +
          tank.id + "/" +
          crypto.randomUUID() + "." +
          extension;

        // Storageへアップロード
        const { error: uploadError } = await supabaseClient
          .storage
          .from("tank-photos")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) {
          errors.push(file.name + "：" + uploadError.message);
          continue;
        }

        // データベースに写真情報を登録
        const { error: insertError } = await supabaseClient
          .from("tank_photos")
          .insert({
            tank_id: tank.id,
            user_id: currentUser.id,
            storage_path: filePath
          });

        if (insertError) {

          // DB登録に失敗した場合は写真も削除
          await supabaseClient
            .storage
            .from("tank-photos")
            .remove([filePath]);

          errors.push(file.name + "：" + insertError.message);
          continue;
        }

        successCount++;
      }

      uploadButton.disabled = false;

      if (errors.length > 0) {
        alert(
          successCount + "枚登録しました。\n\n" +
          errors.join("\n")
        );
      } else {
        alert(successCount + "枚の写真を登録しました。");
      }

      await loadTankPhotos();
    });

    section.appendChild(form);
  }
}


// ==================================
// 水槽内構成の変更履歴
// ==================================


// ----------------------------------
// 変更履歴読み込み
// ----------------------------------

async function loadTankContentLogs() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("tank_content_logs")
    .select("*")
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("変更履歴読み込みエラー:", error);
    alert("変更履歴の読み込みに失敗しました。");
    return;
  }

  tankContentLogs = data || [];

  renderTankContentLogs();
}


// ----------------------------------
// 変更履歴表示
// ----------------------------------

function renderTankContentLogs() {
  tanks.forEach(function(tank) {
    const card = getTankCard(tank.id);

    if (!card) return;

    // 履歴表示エリア
    let section = card.querySelector(".content-logs-section");

    if (!section) {
      section = document.createElement("div");
      section.className = "content-logs-section";
      card.appendChild(section);
    }

    section.replaceChildren();

    // 見出し
    const heading = document.createElement("h4");

    heading.textContent = "構成の変更履歴";

    section.appendChild(heading);

    // この水槽の履歴だけ取得
    const logs = tankContentLogs.filter(function(log) {
      return log.tank_id === tank.id;
    });

    if (logs.length === 0) {
      const empty = document.createElement("p");

      empty.textContent = "まだ変更履歴はありません。";

      section.appendChild(empty);
      return;
    }


    // ----------------------------------
    // 履歴一覧
    // ----------------------------------

    logs.forEach(function(log) {
      const item = document.createElement("div");

      item.className = "history-item";

      // 日時
      const dateText = document.createElement("p");

      dateText.textContent = new Date(
        log.changed_at
      ).toLocaleString("ja-JP");

      // 変更内容
      const detail = document.createElement("p");

      let description = log.action + "｜" + log.category;

      if (log.action === "追加") {
        description +=
          "｜" + log.new_name +
          " × " + log.new_quantity;
      }

      if (log.action === "削除") {
        description +=
          "｜" + log.old_name +
          " × " + log.old_quantity;
      }

      if (log.action === "編集") {
        description +=
          "｜" + log.old_name +
          " → " + log.new_name;

        if (log.old_quantity !== log.new_quantity) {
          description +=
            "｜数量 " +
            log.old_quantity +
            " → " +
            log.new_quantity;
        }

        if (log.old_memo !== log.new_memo) {
          description +=
            "｜メモを変更";
        }
      }

      detail.textContent = description;

      item.append(dateText, detail);
      section.appendChild(item);
    });
  });
}


// ----------------------------------
// 変更履歴保存
// ----------------------------------

async function saveTankContentLog(logData) {
  if (!currentUser) return false;

  const { error } = await supabaseClient
    .from("tank_content_logs")
    .insert({
      tank_id: logData.tank_id,
      user_id: currentUser.id,

      action: logData.action,
      category: logData.category,

      old_name: logData.old_name ?? null,
      new_name: logData.new_name ?? null,

      old_quantity: logData.old_quantity ?? null,
      new_quantity: logData.new_quantity ?? null,

      old_memo: logData.old_memo ?? null,
      new_memo: logData.new_memo ?? null
    });

  if (error) {
    console.error("変更履歴保存エラー:", error);

    alert(
      "構成の変更は完了しましたが、変更履歴の保存に失敗しました：" +
      error.message
    );

    return false;
  }

  await loadTankContentLogs();

  return true;
}
