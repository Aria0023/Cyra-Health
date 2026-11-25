import { useRef, useState } from "react";
import { Switch } from "../ui/index.js";
import Icon from "../Icon.jsx";
import Details from "../Details.jsx";
import { MEAL_COPY as C, PHOTO_MAX_SIDE, PHOTO_QUALITY, fitWithin, photoBody, bodyDataUrl, base64Bytes, totalOf, kcalRange, kcalRangeSaid, plainWords } from "../../lib/mealPhoto.js";

/* Meal photos (Pro, her own switch; docs/plans/meal-photos.md). The parts the Meals sheet (BodySheets.jsx) uses:
   - downsizePhoto: the picked file redrawn on a canvas on this device, at most 1024 px on its long side, as a JPEG. The
     redrawn picture has no EXIF data. Nothing is sent here.
   - PhotoPick: "Add from a photo", a button that opens a plain file input (accept="image/*" capture="environment").
   - MealSendBody: the body of "What Solia Health will send". The exact picture that will go, what goes with it, Send
     and Cancel. Nothing goes until Send; Cancel discards the picture.
   - MealAnswerBody: the answer, each name editable, each food removable, Save or Discard. Nothing is saved until Save.
     (Both are shown by the Meals sheet inside its own dialog, which changes its title: one dialog, never two stacked.)
   - MealEstimate: an estimate saved in a meal note; CalSwitch: "Show calorie estimates".
   No colour, score, target or judgement anywhere: a calorie figure is always a range and always labelled an estimate.
   Every sentence comes from lib/mealPhoto.js MEAL_COPY. */

/** The file → { body, w, h, bytes } (body = the exact request body), or null when it can't be read as a picture. */
export async function downsizePhoto(file) {
  if (!file || typeof file !== "object") return null;
  let src = null, url = null;
  try {
    if (typeof createImageBitmap === "function") {
      try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { src = null; }
    }
    if (!src) {
      url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("not an image")); im.src = url; });
    }
    const size = fitWithin(src.naturalWidth || src.width, src.naturalHeight || src.height, PHOTO_MAX_SIDE);
    if (!size) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size.w; canvas.height = size.h;
    const g = canvas.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, size.w, size.h); // a JPEG has no transparency
    g.drawImage(src, 0, 0, size.w, size.h);
    const body = photoBody(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    canvas.width = 0; canvas.height = 0;
    return body ? { body, w: size.w, h: size.h, bytes: base64Bytes(body.image.data) } : null;
  } catch { return null; } finally {
    if (url) URL.revokeObjectURL(url);
    if (src && typeof src.close === "function") src.close();
  }
}

/* 2026-11-25 (docs/plans/critique-fixes.md Task 3): two ways in, everything after them unchanged. "Take a photo" opens the
   camera (capture="environment"); "Choose a photo" opens her photo library or files (no capture attribute). */
export function PhotoPick({ replace = false, busy = false, onFile }) {
  const camera = useRef(null), library = useRef(null);
  const picked = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFile(f); };
  return (
    <div className="mealphoto-pick">
      <div className="mealphoto-btns">
        <button type="button" className="ghostbtn mealphoto-btn" aria-haspopup="dialog" aria-describedby="mealphoto-hint" disabled={busy} onClick={() => camera.current?.click()}>
          <Icon name="sparkle" size={16} />{replace ? C.takeAgain : C.take}
        </button>
        <button type="button" className="ghostbtn mealphoto-btn" aria-haspopup="dialog" aria-describedby="mealphoto-hint" disabled={busy} onClick={() => library.current?.click()}>
          <Icon name="file" size={16} />{replace ? C.chooseAgain : C.choose}
        </button>
      </div>
      {/* The inputs are out of the tab order and hidden from assistive tech: the buttons above open them. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="mealphoto-file" data-pick="camera" tabIndex={-1} aria-hidden="true" onChange={picked} />
      <input ref={library} type="file" accept="image/*" className="mealphoto-file" data-pick="library" tabIndex={-1} aria-hidden="true" onChange={picked} />
      <p className="rfoot" id="mealphoto-hint">{C.addHint}</p>
    </div>
  );
}

export function MealSendBody({ shot, signedIn = false, busy = false, onSend, onClose }) {
  return (
    <>
      <p className="aisend-lead"><Icon name="shield" size={16} />{C.sheetShort(signedIn)}</p>
      <Details>
        <p className="aisend-full">{C.sheetLead}</p>
        <section className="aisend-sec" aria-labelledby="mealsend-with-h">
          <h3 className="section-lab" id="mealsend-with-h">{C.withLab}</h3>
          <ul className="mealsend-with">
            <li>{C.withNothing}</li>
            {signedIn && <li>{C.withSignin}</li>}
          </ul>
        </section>
      </Details>
      <section className="aisend-sec" aria-labelledby="mealsend-photo-h">
        <h3 className="section-lab" id="mealsend-photo-h">{C.photoLab}</h3>
        <img className="mealsend-img" src={bodyDataUrl(shot.body)} width={shot.w} height={shot.h} alt={C.photoAlt} />
        <p className="rfoot mealsend-facts">{C.photoFacts(shot.w, shot.h, shot.bytes)}</p>
      </section>
      <p className="hint mealsend-only">{C.onlyFood}</p>
      <div className="aisend-acts">
        <button type="button" className="cta aisend-go" disabled={busy} onClick={onSend}>{busy ? C.sending : C.send}</button>
        <button type="button" className="ghostbtn aisend-no" disabled={busy} onClick={onClose}>{C.cancel}</button>
      </div>
      <p className="rfoot" role="status">{busy ? C.reading : ""}</p>
    </>
  );
}

/** One food line: the name, then (while calories are shown) the portion guess and the range. */
function FoodFacts({ it, showCal }) {
  if (!showCal) return null;
  return <span className="mealfood-facts">{it.portion ? `${it.portion} · ` : ""}<span aria-hidden="true">{kcalRange(it)}</span><span className="sr-only">{kcalRangeSaid(it)}</span></span>;
}
const TotalLine = ({ label, range }) => (
  <p className="mealest-total"><b>{label}</b> <span aria-hidden="true">{kcalRange(range)}</span><span className="sr-only">{kcalRangeSaid(range)}</span></p>
);

export function MealAnswerBody({ answer, showCal = true, preg = false, onSave, onDiscard }) {
  const [items, setItems] = useState(() => answer.items.map((it, i) => ({ ...it, key: i })));
  const rename = (key, name) => setItems((l) => l.map((it) => (it.key === key ? { ...it, name } : it)));
  const usable = items.map((it) => ({ ...it, name: plainWords(it.name, 60) })).filter((it) => it.name);
  const save = () => { if (usable.length) onSave({ items: usable.map(({ name, portion, low, high }) => ({ name, portion, low, high })), sure: answer.sure }); };
  return (
    <>
      <p className="hint">{C.answerLead}</p>
      {items.length > 0 ? (
        <ul className="mealfoods" aria-label={C.answerTitle}>
          {items.map((it, i) => (
            <li key={it.key} className="mealfood">
              <label className="sr-only" htmlFor={`mealfood-${it.key}`}>{C.foodName(i + 1)}</label>
              <input id={`mealfood-${it.key}`} className="inp mealfood-name" type="text" maxLength={60} autoComplete="off" value={it.name} onChange={(e) => rename(it.key, e.target.value)} />
              <button type="button" className="linkbtn mealfood-rm" aria-label={C.removeFood(plainWords(it.name, 60) || C.foodName(i + 1))} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>Remove</button>
              <FoodFacts it={it} showCal={showCal} />
            </li>
          ))}
        </ul>
      ) : <p className="hint" role="status">{C.allRemoved}</p>}
      {showCal && usable.length > 0 && <TotalLine label={C.total} range={totalOf(usable)} />}
      {showCal && <p className="rfoot mealest-note">{C.calNote}</p>}
      {!showCal && <p className="rfoot mealest-hidden">{C.calHidden}</p>}
      <p className="rfoot">{C.sureLab}: {C.sure[answer.sure]}.</p>
      {preg && <p className="rfoot mealest-preg">{C.preg}</p>}
      <p className="rfoot">{C.byAI} {C.notKept}</p>
      <div className="aisend-acts">
        <button type="button" className="cta mealanswer-save" disabled={!usable.length} onClick={save}>{C.save}</button>
        <button type="button" className="ghostbtn mealanswer-no" onClick={onDiscard}>{C.discard}</button>
      </div>
    </>
  );
}

/** An estimate saved in a meal note. */
export function MealEstimate({ est, showCal = true, preg = false, onRemove }) {
  return (
    <div className="mealest">
      <p className="lab mealest-tag" id="mealest-lab">{C.savedTag}</p>
      <ul className="mealest-list" aria-labelledby="mealest-lab">
        {est.items.map((it, i) => <li key={i}><span className="mealest-name">{it.name}</span><FoodFacts it={it} showCal={showCal} /></li>)}
      </ul>
      {showCal && <TotalLine label={C.total} range={totalOf(est.items)} />}
      {showCal && <p className="rfoot mealest-note">{C.calNote}</p>}
      {showCal && preg && <p className="rfoot mealest-preg">{C.preg}</p>}
      <button type="button" className="linkbtn mealest-rm" onClick={onRemove}>{C.removeEst}</button>
    </div>
  );
}

/** "Show calorie estimates": the same switch in You → Solia Health's AI and in the Meals sheet. */
export function CalSwitch({ id, shown, onChange }) {
  return (
    <div className="modrow calswitch" data-ai="mealcal">
      <div className="modrow-main"><div className="modinfo"><b id={`${id}-n`}>{C.showCal}</b></div>
        <Switch checked={shown} onChange={onChange} labelledBy={`${id}-n`} describedBy={`${id}-d`} /></div>
      <p className="modadds" id={`${id}-d`}>{C.showCalHint}</p>
    </div>
  );
}
