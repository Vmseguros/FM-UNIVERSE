import { NotificationItem } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

export const notificacoesService = {
  async getAll(clubId?: string): Promise<NotificationItem[]> {
    let list: NotificationItem[] = [];
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'notificacoes');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem));
          // Merge with local dataStore, avoiding duplicates
          const local = dataStore.getNotifications();
          const map = new Map<string, NotificationItem>();
          fromDb.forEach((n) => map.set(n.id, n));
          local.forEach((n) => {
            if (!map.has(n.id)) map.set(n.id, n);
          });
          list = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Falha ao buscar notificações no Firestore. Usando fallback.', err);
      }
    }

    if (list.length === 0) {
      list = dataStore.getNotifications();
    }

    // Sort by date desc
    list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (clubId) {
      return list.filter((n) => !n.clubId || n.clubId === clubId);
    }
    return list;
  },

  async add(notification: NotificationItem): Promise<void> {
    dataStore.addNotification(notification);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'notificacoes', notification.id);
        const cleanNotif = Object.fromEntries(
          Object.entries(notification).filter(([_, v]) => v !== undefined)
        );
        await setDoc(docRef, cleanNotif);
      } catch (err) {
        console.warn('Falha ao persistir notificação no Firestore.', err);
      }
    }
  },

  async create(data: Omit<NotificationItem, 'id' | 'read' | 'date'> & { date?: string; read?: boolean }): Promise<NotificationItem> {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: data.title,
      message: data.message,
      type: data.type,
      date: data.date || new Date().toISOString().split('T')[0],
      read: data.read ?? false,
      link: data.link,
      offerId: data.offerId,
      clubId: data.clubId,
      userId: data.userId,
      createdAt: new Date().toISOString(),
    };
    await this.add(newNotif);
    return newNotif;
  },

  async markAsRead(id: string): Promise<void> {
    dataStore.markNotificationAsRead(id);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'notificacoes', id);
        await updateDoc(docRef, { read: true });
      } catch (err) {
        console.warn('Falha ao atualizar notificação no Firestore.', err);
      }
    }
  },

  async markAllAsRead(clubId?: string): Promise<void> {
    dataStore.markAllNotificationsAsRead(clubId);
  },

  async delete(id: string): Promise<void> {
    dataStore.deleteNotification(id);
  },

  async getUnreadCount(clubId?: string): Promise<number> {
    const list = await this.getAll(clubId);
    return list.filter((n) => !n.read).length;
  },
};

