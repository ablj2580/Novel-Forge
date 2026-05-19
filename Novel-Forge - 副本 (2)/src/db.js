const DB_NAME = 'NovelForgeDB';
const DB_VERSION = 1;

let db = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      if (!database.objectStoreNames.contains('libraryItems')) {
        const libraryStore = database.createObjectStore('libraryItems', { keyPath: 'id' });
        libraryStore.createIndex('bookId', 'bookId', { unique: false });
        libraryStore.createIndex('module', 'module', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('books')) {
        const bookStore = database.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('title', 'title', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('notes')) {
        const noteStore = database.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('bookId', 'bookId', { unique: false });
        noteStore.createIndex('status', 'status', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('chapters')) {
        const chapterStore = database.createObjectStore('chapters', { keyPath: 'id' });
        chapterStore.createIndex('bookId', 'bookId', { unique: false });
        chapterStore.createIndex('order', 'order', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('activities')) {
        database.createObjectStore('activities', { keyPath: 'id' });
      }
    };
  });
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
};

export const saveBooks = (books) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readwrite');
    const store = transaction.objectStore('books');
    
    books.forEach(book => {
      store.put(book);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveLibraryItems = (items) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['libraryItems'], 'readwrite');
    const store = transaction.objectStore('libraryItems');
    
    items.forEach(item => {
      store.put(item);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveNotes = (notes) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notes'], 'readwrite');
    const store = transaction.objectStore('notes');
    
    notes.forEach(note => {
      store.put(note);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveChapters = (chapters) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chapters'], 'readwrite');
    const store = transaction.objectStore('chapters');
    
    chapters.forEach(chapter => {
      store.put(chapter);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveActivities = (activities) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    
    activities.forEach(activity => {
      store.put(activity);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadBooks = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readonly');
    const store = transaction.objectStore('books');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadLibraryItems = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['libraryItems'], 'readonly');
    const store = transaction.objectStore('libraryItems');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadNotes = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadChapters = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const loadActivities = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['activities'], 'readonly');
    const store = transaction.objectStore('activities');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getLibraryItemsByBookId = (bookId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['libraryItems'], 'readonly');
    const store = transaction.objectStore('libraryItems');
    const index = store.index('bookId');
    const request = index.getAll(bookId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getLibraryItemById = (id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['libraryItems'], 'readonly');
    const store = transaction.objectStore('libraryItems');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteLibraryItem = (id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['libraryItems'], 'readwrite');
    const store = transaction.objectStore('libraryItems');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearAllData = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books', 'libraryItems', 'notes', 'chapters', 'activities'], 'readwrite');
    
    transaction.objectStore('books').clear();
    transaction.objectStore('libraryItems').clear();
    transaction.objectStore('notes').clear();
    transaction.objectStore('chapters').clear();
    transaction.objectStore('activities').clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};