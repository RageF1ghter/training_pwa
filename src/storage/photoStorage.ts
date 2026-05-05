import type { DayPhoto } from "../types";

const PHOTO_DB = "fitlog.photos";
const PHOTO_STORE = "photos";

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withPhotoStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openPhotoDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE, mode);
        const request = run(transaction.objectStore(PHOTO_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          reject(transaction.error);
          db.close();
        };
      }),
  );
}

export function getPhotos() {
  return withPhotoStore<DayPhoto[]>("readonly", (store) => store.getAll());
}

export function savePhoto(photo: DayPhoto) {
  return withPhotoStore<IDBValidKey>("readwrite", (store) => store.put(photo));
}

export function removePhoto(id: string) {
  return withPhotoStore<undefined>("readwrite", (store) => store.delete(id));
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
