// Backend URL'i otomatik olarak mevcut host'tan türet.
// Bu sayede farklı bir cihazdan açıldığında da doğru IP'ye bağlanır.
export const BACKEND_URL = `http://${window.location.hostname}:3000`;
