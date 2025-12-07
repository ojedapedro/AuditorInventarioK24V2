
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Barcode, FileText, History, CheckCircle, AlertTriangle, User, MapPin, Save, X, RotateCcw, Search, Lock, LogOut, ArrowRight, Users, UserPlus, Trash2, Shield, Bell, Calendar, Plus, ToggleLeft, ToggleRight, Hash } from 'lucide-react';
import { AuditService } from './services/auditService';
import { UserService } from './services/userService';
import { AuditSession, AuditStatus, InventoryItem, HistoryEntry, User as UserType, ScheduledAudit } from './types';

// Helper component for Cards
const Card = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // User Management State
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Auditor' });
  const [userMsg, setUserMsg] = useState('');

  // Scheduling & Notifications State
  const [scheduledAudits, setScheduledAudits] = useState<ScheduledAudit[]>([]);
  const [myNotifications, setMyNotifications] = useState<ScheduledAudit[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ storeName: '', assignedTo: '', dueDate: '' });
  const [scheduleMsg, setScheduleMsg] = useState('');

  // App State
  const [status, setStatus] = useState<AuditStatus>(AuditStatus.IDLE);
  const [sessionData, setSessionData] = useState<Partial<AuditSession>>({});
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  // Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScanned, setLastScanned] = useState<InventoryItem | null>(null);
  const [lastQtyAdded, setLastQtyAdded] = useState<number>(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manual Quantity State
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null);
  const [qtyFormValue, setQtyFormValue] = useState('');
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    UserService.initialize();
    setHistory(AuditService.getHistory());
    // Load users initially for assignment dropdowns
    setUsersList(UserService.getUsers());
  }, []);

  // Update notifications when user changes or scheduled audits update
  useEffect(() => {
    if (currentUser) {
      const allScheduled = AuditService.getScheduledAudits();
      setScheduledAudits(allScheduled);
      
      const mine = allScheduled.filter(a => 
        (a.assignedToUsername === currentUser.username || currentUser.role === 'Admin') && 
        a.status === 'PENDING'
      );
      
      const myPending = allScheduled.filter(a => 
        a.assignedToUsername === currentUser.username && a.status === 'PENDING'
      );
      setMyNotifications(myPending);
    }
  }, [currentUser, showScheduleModal]);

  // Ensure focus on input during audit
  useEffect(() => {
    if (status === AuditStatus.ACTIVE && !showQtyModal) {
      inputRef.current?.focus();
    }
  }, [status, lastScanned, showQtyModal]);

  // Focus on quantity input when modal opens
  useEffect(() => {
    if (showQtyModal) {
      setTimeout(() => qtyInputRef.current?.focus(), 100);
    }
  }, [showQtyModal]);

  // Auto-fill auditor name when setting up
  useEffect(() => {
    if (status === AuditStatus.SETUP && currentUser && !sessionData.auditorName) {
      setSessionData(prev => ({ ...prev, auditorName: currentUser.name }));
    }
  }, [status, currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = UserService.authenticate(loginUsername, loginPassword);
    
    if (user) {
      setCurrentUser(user);
      setLoginError('');
      setLoginPassword('');
    } else {
      setLoginError('Credenciales inválidas. Intente nuevamente.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    resetApp();
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setShowNotifications(false);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.username || !newUser.password) {
      setUserMsg('Por favor completa todos los campos.');
      return;
    }

    const success = UserService.addUser({
      name: newUser.name,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role as 'Admin' | 'Auditor'
    });

    if (success) {
      setUsersList(UserService.getUsers());
      setNewUser({ name: '', username: '', password: '', role: 'Auditor' });
      setUserMsg('Usuario creado exitosamente.');
      setTimeout(() => setUserMsg(''), 3000);
    } else {
      setUserMsg('El nombre de usuario ya existe.');
    }
  };

  const handleDeleteUser = (username: string) => {
    if (confirm(`¿Estás seguro de eliminar al usuario ${username}?`)) {
      UserService.deleteUser(username);
      setUsersList(UserService.getUsers());
    }
  };

  const handleScheduleAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newSchedule.storeName || !newSchedule.assignedTo || !newSchedule.dueDate) {
      setScheduleMsg('Completa todos los campos');
      return;
    }

    const audit: ScheduledAudit = {
      id: Math.random().toString(36).substr(2, 9),
      storeName: newSchedule.storeName,
      dueDate: newSchedule.dueDate,
      assignedToUsername: newSchedule.assignedTo,
      assignedBy: currentUser?.username || 'admin',
      status: 'PENDING'
    };

    AuditService.addScheduledAudit(audit);
    setNewSchedule({ storeName: '', assignedTo: '', dueDate: '' });
    setScheduleMsg('Auditoría programada con éxito');
    setTimeout(() => {
      setScheduleMsg('');
      setShowScheduleModal(false);
    }, 1500);
  };

  const handleNotificationClick = (audit: ScheduledAudit) => {
    setShowNotifications(false);
    setStatus(AuditStatus.SETUP);
    setSessionData({
      storeName: audit.storeName,
      auditorName: currentUser?.name
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const parsedItems = await AuditService.parseExcel(e.target.files[0]);
        setItems(parsedItems);
      } catch (err) {
        alert("Error al leer el archivo Excel. Asegúrate de tener columnas como 'SKU', 'Descripcion', 'Cantidad'.");
      }
    }
  };

  const startAudit = () => {
    if (!sessionData.storeName || !sessionData.auditorName || items.length === 0) {
      alert("Por favor completa todos los campos y carga el inventario.");
      return;
    }
    
    setStatus(AuditStatus.ACTIVE);
    setSessionData({
      ...sessionData,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      status: AuditStatus.ACTIVE
    });
  };

  const updateItemQuantity = (index: number, qtyToAdd: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      physicalQty: newItems[index].physicalQty + qtyToAdd,
      scannedAt: new Date().toISOString()
    };
    setItems(newItems);
    setLastScanned(newItems[index]);
    setLastQtyAdded(qtyToAdd);
    setScanError(null);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    let searchInput = barcodeInput.trim();
    let quantityToAdd = 1;
    let foundIndex = -1;
    let isExplicitQuantity = false;

    // Helper to find item index
    const findItemIndex = (code: string) => items.findIndex(i => 
      i.sku.toLowerCase() === code.toLowerCase() || 
      i.id.toLowerCase() === code.toLowerCase()
    );

    // Strategy 1: Exact Match (Qty 1)
    foundIndex = findItemIndex(searchInput);

    // Strategy 2: Space Separator (SKU QTY)
    if (foundIndex === -1) {
      const lastSpaceIndex = searchInput.lastIndexOf(' ');
      if (lastSpaceIndex !== -1) {
        const potentialSku = searchInput.substring(0, lastSpaceIndex);
        const potentialQtyStr = searchInput.substring(lastSpaceIndex + 1);
        
        if (/^\d+$/.test(potentialQtyStr)) {
          const idx = findItemIndex(potentialSku);
          if (idx !== -1) {
            foundIndex = idx;
            quantityToAdd = parseInt(potentialQtyStr, 10);
            isExplicitQuantity = true;
          }
        }
      }
    }

    // Strategy 3: Asterisk Separator (QTY*SKU or SKU*QTY)
    if (foundIndex === -1 && searchInput.includes('*')) {
      const parts = searchInput.split('*');
      if (parts.length === 2) {
        // QTY*SKU
        if (/^\d+$/.test(parts[0])) {
           const idx = findItemIndex(parts[1]);
           if (idx !== -1) {
             foundIndex = idx;
             quantityToAdd = parseInt(parts[0], 10);
             isExplicitQuantity = true;
           }
        }
        // SKU*QTY
        if (foundIndex === -1 && /^\d+$/.test(parts[1])) {
           const idx = findItemIndex(parts[0]);
           if (idx !== -1) {
             foundIndex = idx;
             quantityToAdd = parseInt(parts[1], 10);
             isExplicitQuantity = true;
           }
        }
      }
    }

    if (foundIndex >= 0) {
      // Logic for Manual Mode
      // If manual mode is ON, and user did NOT provide an explicit quantity (like "SKU 10"), 
      // then prompt for quantity.
      if (manualEntryMode && !isExplicitQuantity) {
        setPendingItem(items[foundIndex]);
        setQtyFormValue('');
        setShowQtyModal(true);
      } else {
        updateItemQuantity(foundIndex, quantityToAdd);
      }
    } else {
      setScanError(`Código no encontrado: ${searchInput}`);
      setLastScanned(null);
      setLastQtyAdded(0);
    }
    setBarcodeInput('');
  };

  const confirmManualQty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingItem) return;

    const qty = parseInt(qtyFormValue, 10);
    if (isNaN(qty)) return; // Allow 0 or negative corrections if needed, or restrict to >0

    const idx = items.findIndex(i => i.id === pendingItem.id);
    if (idx !== -1) {
      updateItemQuantity(idx, qty);
    }
    
    setShowQtyModal(false);
    setPendingItem(null);
    setQtyFormValue('');
  };

  const finishAudit = () => {
    setStatus(AuditStatus.COMPLETED);
  };

  const saveAndDownload = () => {
    const fullSession: AuditSession = {
      ...(sessionData as AuditSession),
      items: items,
      status: AuditStatus.COMPLETED
    };
    
    AuditService.saveToHistory(fullSession);
    // Mark schedule as complete if it exists for this store/user
    if (currentUser) {
      AuditService.completeScheduledAudit(fullSession.storeName, currentUser.username);
      // Refresh list
      const allScheduled = AuditService.getScheduledAudits();
      setScheduledAudits(allScheduled);
      setMyNotifications(allScheduled.filter(a => 
        a.assignedToUsername === currentUser.username && a.status === 'PENDING'
      ));
    }

    AuditService.generatePDF(fullSession);
    setHistory(AuditService.getHistory());
  };

  const resetApp = () => {
    if (status === AuditStatus.IDLE && !currentUser) {
        setStatus(AuditStatus.IDLE);
        setItems([]);
        setSessionData({});
        return;
    }

    if (status === AuditStatus.IDLE || status === AuditStatus.MANAGE_USERS) {
        setStatus(AuditStatus.IDLE);
        setItems([]);
        setSessionData({});
        return;
    }

    if (confirm("¿Estás seguro de salir? Se perderán los datos no guardados.")) {
      setStatus(AuditStatus.IDLE);
      setItems([]);
      setSessionData({});
      setLastScanned(null);
      setSearchQuery('');
      setManualEntryMode(false);
    }
  };

  // --- Views ---

  const renderLogin = () => (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="https://i.ibb.co/TM2v02nJ/descarga.png" alt="Logo" className="h-12 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido a AuditPro</h1>
          <p className="text-gray-500 mt-2">Inicia sesión para acceder al sistema de inventario</p>
        </div>
        
        <Card className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ej. admin"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="password" 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
            >
              Iniciar Sesión
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-400">Default: admin / xxx</p>
          </div>
        </Card>
        <p className="text-center text-xs text-gray-400 mt-8">© 2025 AuditPro Inventory System</p>
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => status !== AuditStatus.ACTIVE && resetApp()}>
          <img src="https://i.ibb.co/TM2v02nJ/descarga.png" alt="Logo" className="h-8 object-contain" />
          <span className="text-xl font-bold text-gray-800 tracking-tight border-l pl-3 ml-1 border-gray-300 hidden sm:block">AuditPro</span>
        </div>
        
        {currentUser && (
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{currentUser.name}</span>
              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">{currentUser.role}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="text-gray-600 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100 transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {myNotifications.length > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-white"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <h4 className="font-bold text-gray-700 text-sm">Notificaciones</h4>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{myNotifications.length}</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {myNotifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          No tienes auditorías pendientes.
                        </div>
                      ) : (
                        myNotifications.map(notification => (
                          <div 
                            key={notification.id} 
                            onClick={() => status === AuditStatus.IDLE && handleNotificationClick(notification)}
                            className={`p-4 border-b border-gray-50 hover:bg-blue-50 transition-colors cursor-pointer group ${status !== AuditStatus.IDLE ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                             <div className="flex items-start gap-3">
                               <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1">
                                 <Calendar className="w-4 h-4" />
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-gray-800 group-hover:text-blue-700">{notification.storeName}</p>
                                 <p className="text-xs text-gray-500">Programada para: {new Date(notification.dueDate).toLocaleDateString()}</p>
                                 <p className="text-xs text-blue-500 mt-1">Click para iniciar</p>
                               </div>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {status !== AuditStatus.IDLE && (
                <button 
                  onClick={resetApp}
                  className="text-sm font-medium text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> 
                  <span className="hidden sm:inline">Cerrar Vista</span>
                </button>
              )}
              
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );

  const renderScheduleModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={() => setShowScheduleModal(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Programar Auditoría
        </h3>
        
        <form onSubmit={handleScheduleAudit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tienda / Sucursal</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej. Tienda Norte"
              value={newSchedule.storeName}
              onChange={e => setNewSchedule({...newSchedule, storeName: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={newSchedule.assignedTo}
              onChange={e => setNewSchedule({...newSchedule, assignedTo: e.target.value})}
            >
              <option value="">Seleccionar Auditor</option>
              {usersList.map(u => (
                <option key={u.username} value={u.username}>{u.name} ({u.username})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
            <input 
              type="date" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={newSchedule.dueDate}
              onChange={e => setNewSchedule({...newSchedule, dueDate: e.target.value})}
            />
          </div>

          {scheduleMsg && (
             <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm text-center">
               {scheduleMsg}
             </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold mt-4"
          >
            Confirmar Programación
          </button>
        </form>
      </Card>
    </div>
  );

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
          <p className="text-gray-500">Bienvenido de nuevo, {currentUser?.name}</p>
        </div>
        {currentUser?.role === 'Admin' && (
           <button 
             onClick={() => setShowScheduleModal(true)}
             className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm shadow-lg transition-all"
           >
             <Calendar className="w-4 h-4" /> Programar Auditoría
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* New Audit Action */}
        <Card className="p-8 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow cursor-pointer border-dashed border-2 border-blue-200 bg-blue-50" >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Barcode className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Nuevo Inventario</h2>
          <p className="text-gray-500 text-sm mb-6">Carga tu Excel y comienza a escanear.</p>
          <button 
            onClick={() => setStatus(AuditStatus.SETUP)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20"
          >
            Comenzar
          </button>
        </Card>

        {/* User Management (Admin Only) */}
        {currentUser?.role === 'Admin' && (
          <Card className="p-8 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Gestionar Usuarios</h2>
            <p className="text-gray-500 text-sm mb-6">Agregar o eliminar auditores del sistema.</p>
            <button 
              onClick={() => {
                setUsersList(UserService.getUsers());
                setStatus(AuditStatus.MANAGE_USERS);
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-purple-600/20"
            >
              Administrar
            </button>
          </Card>
        )}

        {/* Recent History */}
        <Card className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" /> Historial Reciente
            </h3>
          </div>
          {history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-8 text-gray-400 text-sm">No hay auditorías registradas.</div>
          ) : (
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 max-h-64">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{entry.storeName}</p>
                    <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold ${entry.totalDiscrepancies > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {entry.totalDiscrepancies === 0 ? 'OK' : `${entry.totalDiscrepancies} Incidencias`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="p-6 md:col-span-1 h-fit">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-gray-500" /> Agregar Usuario
          </h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
                placeholder="juanp"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                placeholder="123456"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="Auditor">Auditor</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>
            
            {userMsg && (
               <div className={`text-xs p-2 rounded ${userMsg.includes('exitosamente') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                 {userMsg}
               </div>
            )}

            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium text-sm transition-colors">
              Crear Usuario
            </button>
          </form>
        </Card>

        {/* List */}
        <Card className="p-6 md:col-span-2">
           <h3 className="font-bold text-gray-800 mb-4">Usuarios Registrados ({usersList.length})</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-600">
                 <tr>
                   <th className="px-4 py-2 rounded-tl-lg">Nombre</th>
                   <th className="px-4 py-2">Usuario</th>
                   <th className="px-4 py-2">Rol</th>
                   <th className="px-4 py-2 rounded-tr-lg text-right">Acciones</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {usersList.map(user => (
                   <tr key={user.username} className="hover:bg-gray-50">
                     <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                     <td className="px-4 py-3 text-gray-500">{user.username}</td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                         {user.role}
                       </span>
                     </td>
                     <td className="px-4 py-3 text-right">
                       {user.username !== 'admin' && user.username !== currentUser?.username && (
                         <button 
                           onClick={() => handleDeleteUser(user.username)}
                           className="text-gray-400 hover:text-red-600 transition-colors p-1"
                           title="Eliminar usuario"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                       {user.username === 'admin' && (
                         <Shield className="w-4 h-4 text-gray-300 inline-block" title="Usuario Sistema" />
                       )}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </Card>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuración de Auditoría</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tienda / Sucursal</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ej. Tienda Central"
                  value={sessionData.storeName || ''}
                  onChange={e => setSessionData({...sessionData, storeName: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50 text-gray-500"
                  placeholder="Tu Nombre"
                  value={sessionData.auditorName || ''}
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cargar Inventario Teórico (.xlsx)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500"><span className="font-semibold">Click para subir</span> o arrastra el archivo</p>
                  <p className="text-xs text-gray-500 mt-1">Requiere columnas: SKU, Descripcion, Cantidad</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
              </label>
            </div>
            {items.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{items.length} productos cargados correctamente.</span>
              </div>
            )}
          </div>

          <button 
            onClick={startAudit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg shadow-lg shadow-blue-600/20 transition-all mt-4"
          >
            Iniciar Toma de Inventario
          </button>
        </div>
      </Card>
    </div>
  );

  const renderActiveAudit = () => {
    const totalPhysical = items.reduce((acc, i) => acc + i.physicalQty, 0);
    const progress = Math.round((items.filter(i => i.physicalQty > 0).length / items.length) * 100) || 0;

    const filteredItems = items.filter(item => 
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="max-w-7xl mx-auto px-4 py-6 h-[calc(100vh-64px)] flex flex-col relative">
        {/* Quantity Modal */}
        {showQtyModal && pendingItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <Card className="w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
               <div className="text-center mb-6">
                 <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                   <Hash className="w-6 h-6 text-blue-600" />
                 </div>
                 <h3 className="text-lg font-bold text-gray-900">{pendingItem.sku}</h3>
                 <p className="text-sm text-gray-500 truncate">{pendingItem.description}</p>
               </div>
               
               <form onSubmit={confirmManualQty}>
                 <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Ingresar Cantidad</label>
                   <input
                     ref={qtyInputRef}
                     type="number"
                     className="w-full text-center text-4xl font-bold p-4 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                     value={qtyFormValue}
                     onChange={(e) => setQtyFormValue(e.target.value)}
                     placeholder="0"
                     autoFocus
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => { setShowQtyModal(false); setPendingItem(null); setQtyFormValue(''); inputRef.current?.focus(); }}
                      className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20"
                    >
                      Confirmar
                    </button>
                 </div>
               </form>
            </Card>
          </div>
        )}

        {/* Top Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gray-800 text-white border-none">
            <p className="text-gray-400 text-xs uppercase font-bold">Total Scaneado</p>
            <p className="text-3xl font-mono">{totalPhysical}</p>
          </Card>
          <Card className="p-4">
            <p className="text-gray-500 text-xs uppercase font-bold">Progreso (Items)</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-blue-600">{progress}%</p>
              <p className="text-sm text-gray-400 mb-1">{items.filter(i => i.physicalQty > 0).length} / {items.length}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
          </Card>
          <Card className="p-4 col-span-2 flex items-center justify-between">
             <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Tienda</p>
                <p className="font-semibold text-gray-800">{sessionData.storeName}</p>
             </div>
             <button 
                onClick={finishAudit}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
             >
               Finalizar Inventario
             </button>
          </Card>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          
          {/* Left Column: Scanner & Feedback */}
          <div className="flex flex-col gap-6">
            <Card className="p-6 border-blue-500 border-2 shadow-lg shadow-blue-500/10">
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                Escanear Código de Barras
              </label>
              <form onSubmit={handleScan} className="relative mb-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-4 pr-12 py-4 text-xl font-mono border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-0 outline-none transition-colors"
                  placeholder="Scan..."
                  disabled={showQtyModal}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Barcode className="w-6 h-6 text-gray-400" />
                </div>
              </form>
              
              <div className="flex items-center justify-between mb-2">
                 <button 
                   type="button" 
                   onClick={() => setManualEntryMode(!manualEntryMode)}
                   className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${manualEntryMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                 >
                   {manualEntryMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                   Solicitar cantidad al escanear
                 </button>
              </div>
              
              <p className="text-xs text-gray-400 mt-2 text-center">Scan simple o formato "SKU cantidad" (ej. "A123 5")</p>
              
              {scanError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">{scanError}</span>
                </div>
              )}
            </Card>

            {/* Last Scanned Item Card */}
            {lastScanned ? (
              <Card className="flex-1 p-6 bg-gradient-to-br from-white to-gray-50 flex flex-col justify-center items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden">
                {lastQtyAdded > 0 && (
                    <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 shadow-sm animate-bounce">
                        +{lastQtyAdded} unidades
                    </div>
                )}
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{lastScanned.sku}</h3>
                <p className="text-lg text-gray-600 mb-6">{lastScanned.description}</p>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase">Teórico</p>
                    <p className="text-xl font-bold text-gray-700">{lastScanned.theoreticalQty}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 uppercase font-bold">Físico</p>
                    <p className="text-xl font-bold text-blue-700">{lastScanned.physicalQty}</p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
                Esperando primer scan...
              </div>
            )}
          </div>

          {/* Right Column: List */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden h-full">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-2">
                 <h3 className="font-bold text-gray-700">Inventario en Tiempo Real</h3>
                 <span className="hidden sm:inline-block text-xs px-2 py-1 bg-white border rounded-full text-gray-500 border-gray-200">
                   {items.length} total
                 </span>
               </div>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="text" 
                   placeholder="Buscar SKU o descripción..." 
                   className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-600">SKU</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">Descripción</th>
                    <th className="px-6 py-3 font-semibold text-gray-600 text-center">Teórico</th>
                    <th className="px-6 py-3 font-semibold text-gray-600 text-center">Físico</th>
                    <th className="px-6 py-3 font-semibold text-gray-600 text-center">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        {items.length === 0 ? "No hay items cargados" : `No se encontraron resultados para "${searchQuery}"`}
                      </td>
                    </tr>
                  ) : (
                    // Sort by scannedAt (descending) then by SKU
                    [...filteredItems].sort((a, b) => {
                      if (a.scannedAt && !b.scannedAt) return -1;
                      if (!a.scannedAt && b.scannedAt) return 1;
                      if (a.scannedAt && b.scannedAt) return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
                      return 0;
                    }).map((item) => {
                       const diff = item.physicalQty - item.theoreticalQty;
                       const isDiff = diff !== 0;
                       return (
                        <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.physicalQty > 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-6 py-3 font-mono text-gray-600 font-medium">{item.sku}</td>
                          <td className="px-6 py-3 text-gray-800">{item.description}</td>
                          <td className="px-6 py-3 text-center text-gray-600">{item.theoreticalQty}</td>
                          <td className={`px-6 py-3 text-center font-bold ${item.physicalQty > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {item.physicalQty}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {isDiff ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${diff < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                            ) : (
                                <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                       );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      </div>
    );
  };

  const renderCompleted = () => {
    const totalDiscrepancies = items.filter(i => i.physicalQty !== i.theoreticalQty).length;
    const accuracy = ((1 - (totalDiscrepancies / items.length)) * 100).toFixed(1);

    // Filter items with discrepancies
    const discrepancyItems = items.filter(i => i.physicalQty !== i.theoreticalQty);

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Auditoría Finalizada</h2>
            <p className="text-gray-500 mt-2">Revisa los resultados antes de guardar.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-500 uppercase font-bold">Total Items</p>
              <p className="text-2xl font-bold text-gray-800">{items.length}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-500 uppercase font-bold">Incidencias</p>
              <p className={`text-2xl font-bold ${totalDiscrepancies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalDiscrepancies}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-500 uppercase font-bold">Precisión</p>
              <p className="text-2xl font-bold text-blue-600">{accuracy}%</p>
            </div>
          </div>

          {/* New Section: Discrepancies Summary */}
          {discrepancyItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Resumen de Incidencias
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-gray-600">SKU</th>
                        <th className="px-4 py-2 font-semibold text-gray-600">Descripción</th>
                        <th className="px-4 py-2 font-semibold text-gray-600 text-center">Teórico</th>
                        <th className="px-4 py-2 font-semibold text-gray-600 text-center">Físico</th>
                        <th className="px-4 py-2 font-semibold text-gray-600 text-center">Dif.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discrepancyItems.map((item) => {
                         const diff = item.physicalQty - item.theoreticalQty;
                         return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-gray-600">{item.sku}</td>
                            <td className="px-4 py-2 text-gray-800 truncate max-w-[200px]" title={item.description}>{item.description}</td>
                            <td className="px-4 py-2 text-center text-gray-600">{item.theoreticalQty}</td>
                            <td className="px-4 py-2 text-center text-gray-800 font-medium">{item.physicalQty}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${diff < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            </td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones Generales</label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Escribe aquí notas importantes sobre el inventario..."
              value={sessionData.observations || ''}
              onChange={e => setSessionData({...sessionData, observations: e.target.value})}
            ></textarea>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setStatus(AuditStatus.ACTIVE)}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Volver a Escanear
            </button>
            <button 
              onClick={saveAndDownload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Guardar y Descargar PDF
            </button>
          </div>
        </Card>
      </div>
    );
  };

  if (!currentUser) {
    return renderLogin();
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {renderHeader()}
      <main>
        {status === AuditStatus.IDLE && renderDashboard()}
        {status === AuditStatus.MANAGE_USERS && renderUserManagement()}
        {status === AuditStatus.SETUP && renderSetup()}
        {status === AuditStatus.ACTIVE && renderActiveAudit()}
        {status === AuditStatus.COMPLETED && renderCompleted()}
        {showScheduleModal && renderScheduleModal()}
      </main>
    </div>
  );
}
