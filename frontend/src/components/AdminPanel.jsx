import React, { useState, useEffect } from 'react';
import { Users, Shield, Calendar, Trash2, CheckCircle2, XCircle, RefreshCw, Save, AlertCircle, Plus, Server, CheckSquare, Settings } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'servers'
  
  // Users States
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editStatus, setEditStatus] = useState('approved');
  const [editExpires, setEditExpires] = useState('');

  // IPTV Servers States
  const [servers, setServers] = useState([]);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerUser, setNewServerUser] = useState('');
  const [newServerPass, setNewServerPass] = useState('');
  const [newServerPriority, setNewServerPriority] = useState(1);
  const [editingServerId, setEditingServerId] = useState(null);
  const [editServerName, setEditServerName] = useState('');
  const [editServerUrl, setEditServerUrl] = useState('');
  const [editServerUser, setEditServerUser] = useState('');
  const [editServerPass, setEditServerPass] = useState('');
  const [editServerActive, setEditServerActive] = useState(true);
  const [editServerPriority, setEditServerPriority] = useState(1);

  // General Loading/Errors
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const token = localStorage.getItem('streamtv_token');

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${backendUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');
      setUsers(data.users || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${backendUrl}/api/admin/servers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar servidores IPTV');
      setServers(data.servers || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchServers();
    }
  }, [activeTab]);

  // User Actions
  const handleStartEditUser = (user) => {
    setEditingUserId(user.id);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditExpires(user.expires_at ? new Date(user.expires_at).toISOString().split('T')[0] : '');
  };

  const handleSaveEditUser = async (userId) => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          expires_at: editExpires || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
      
      setUsers(users.map(u => u.id === userId ? { ...u, ...data.user } : u));
      setEditingUserId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar usuario');
      }
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      alert(err.message);
    }
  };

  // IPTV Server Actions
  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!newServerName || !newServerUrl || !newServerUser || !newServerPass) return;
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/admin/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newServerName,
          url: newServerUrl,
          username: newServerUser,
          password: newServerPass,
          priority: newServerPriority,
          is_active: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar servidor');

      setServers([...servers, data.server]);
      setShowAddServerModal(false);
      setNewServerName('');
      setNewServerUrl('');
      setNewServerUser('');
      setNewServerPass('');
      setNewServerPriority(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditServer = (server) => {
    setEditingServerId(server.id);
    setEditServerName(server.name);
    setEditServerUrl(server.url);
    setEditServerUser(server.username);
    setEditServerPass(server.password);
    setEditServerActive(server.is_active);
    setEditServerPriority(server.priority);
  };

  const handleSaveEditServer = async (serverId) => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editServerName,
          url: editServerUrl,
          username: editServerUser,
          password: editServerPass,
          is_active: editServerActive,
          priority: editServerPriority
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar servidor');

      setServers(servers.map(s => s.id === serverId ? data.server : s));
      setEditingServerId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este servidor IPTV?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/admin/servers/${serverId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar servidor');
      setServers(servers.filter(s => s.id !== serverId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#141414] p-4 sm:p-6 space-y-6 overflow-y-auto select-none">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-2xl text-red-500">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Panel de Administración</h2>
            <p className="text-xs text-neutral-400">Administra accesos y configura proveedores de televisión</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'users' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios</span>
          </button>
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'servers' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Servidores IPTV</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/60 border border-red-800/40 p-4 rounded-2xl flex gap-3 text-xs text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : activeTab === 'users' ? (
        /* USERS LIST TAB */
        <div className="glass-panel border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Vencimiento</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {users.map((user) => {
                  const isEditing = editingUserId === user.id;
                  const isExpired = user.expires_at && new Date(user.expires_at) < new Date();

                  return (
                    <tr key={user.id} className="hover:bg-neutral-900/40 transition">
                      <td className="p-4 font-medium text-white">
                        <div>{user.name || 'Sin Nombre'}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{user.email}</div>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-600"
                          >
                            <option value="admin">Administrador</option>
                            <option value="user">Usuario</option>
                            <option value="trial">Prueba (Beta)</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            user.role === 'admin' 
                              ? 'bg-red-950/40 border-red-800/40 text-red-400' 
                              : user.role === 'trial'
                              ? 'bg-amber-950/40 border-amber-800/40 text-amber-400'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                          }`}>
                            {user.role === 'admin' ? 'Admin' : user.role === 'trial' ? 'Beta' : 'Usuario'}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-600"
                          >
                            <option value="approved">Aprobado</option>
                            <option value="pending">Pendiente</option>
                            <option value="rejected">Rechazado</option>
                          </select>
                        ) : (
                          <span className={`flex items-center gap-1 font-bold ${
                            user.status === 'approved' ? 'text-green-500' : 'text-red-400'
                          }`}>
                            {user.status === 'approved' ? (
                              <CheckCircle2 className="w-4 h-4 fill-green-950/20" />
                            ) : (
                              <XCircle className="w-4 h-4 fill-red-950/20" />
                            )}
                            <span>{user.status === 'approved' ? 'Activo' : 'Suspendido'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editExpires}
                            onChange={(e) => setEditExpires(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-600"
                          />
                        ) : (
                          <span className={`font-medium ${isExpired ? 'text-red-400' : 'text-neutral-300'}`}>
                            {user.expires_at 
                              ? new Date(user.expires_at).toLocaleString() + (isExpired ? ' (Expirado)' : '')
                              : 'Permanente'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleSaveEditUser(user.id)}
                              className="p-1.5 bg-green-950 hover:bg-green-900 border border-green-800 text-green-400 rounded-lg cursor-pointer transition"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 rounded-lg cursor-pointer transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleStartEditUser(user)}
                              className="p-1.5 hover:bg-neutral-800 text-neutral-300 rounded-lg cursor-pointer transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 hover:bg-red-950/40 text-red-500 rounded-lg cursor-pointer transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* IPTV SERVERS TAB */
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-neutral-300">Lista de Proveedores IPTV</h3>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-md shadow-red-950/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Servidor</span>
            </button>
          </div>

          <div className="glass-panel border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Servidor</th>
                    <th className="p-4">URL Host</th>
                    <th className="p-4">Credenciales</th>
                    <th className="p-4">Prioridad</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {servers.map((server) => {
                    const isEditing = editingServerId === server.id;

                    return (
                      <tr key={server.id} className="hover:bg-neutral-900/40 transition">
                        <td className="p-4 font-bold text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editServerName}
                              onChange={(e) => setEditServerName(e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs text-white max-w-[120px]"
                            />
                          ) : (
                            server.name
                          )}
                        </td>
                        <td className="p-4 font-mono text-neutral-300">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editServerUrl}
                              onChange={(e) => setEditServerUrl(e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs text-white max-w-[200px]"
                            />
                          ) : (
                            server.url
                          )}
                        </td>
                        <td className="p-4 text-neutral-400">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editServerUser}
                                onChange={(e) => setEditServerUser(e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs text-white max-w-[80px]"
                                placeholder="Usuario"
                              />
                              <input
                                type="text"
                                value={editServerPass}
                                onChange={(e) => setEditServerPass(e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs text-white max-w-[80px]"
                                placeholder="Clave"
                              />
                            </div>
                          ) : (
                            <span>{server.username} / {server.password.replace(/./g, '*')}</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editServerPriority}
                              onChange={(e) => setEditServerPriority(parseInt(e.target.value, 10))}
                              className="bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs text-white max-w-[50px] text-center"
                            />
                          ) : (
                            `P-${server.priority}`
                          )}
                        </td>
                        <td className="p-4">
                          {isEditing ? (
                            <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editServerActive}
                                onChange={(e) => setEditServerActive(e.target.checked)}
                                className="accent-red-600"
                              />
                              Activo
                            </label>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              server.is_active
                                ? 'bg-green-950/40 border-green-800/40 text-green-400'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}>
                              {server.is_active ? 'Activo' : 'Desactivado'}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isEditing ? (
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => handleSaveEditServer(server.id)}
                                className="p-1.5 bg-green-950 hover:bg-green-900 border border-green-800 text-green-400 rounded-lg cursor-pointer transition"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingServerId(null)}
                                className="p-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 rounded-lg cursor-pointer transition"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => handleStartEditServer(server)}
                                className="p-1.5 hover:bg-neutral-800 text-neutral-300 rounded-lg cursor-pointer transition"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteServer(server.id)}
                                className="p-1.5 hover:bg-red-950/40 text-red-500 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
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

      {/* Add Server Modal Dialog */}
      {showAddServerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6">
          <form onSubmit={handleAddServer} className="glass-panel border border-neutral-800/80 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-red-500" />
              <span>Agregar Nuevo Servidor IPTV</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Nombre Proveedor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Servidor Respaldo"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">URL del Host</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. http://urlproveedor.com:8080"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Usuario</label>
                  <input
                    type="text"
                    required
                    placeholder="Usuario"
                    value={newServerUser}
                    onChange={(e) => setNewServerUser(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Contraseña</label>
                  <input
                    type="text"
                    required
                    placeholder="Clave"
                    value={newServerPass}
                    onChange={(e) => setNewServerPass(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Prioridad de Failover (1 = Alta)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newServerPriority}
                  onChange={(e) => setNewServerPriority(parseInt(e.target.value, 10))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-red-950/50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddServerModal(false)}
                className="flex-1 py-3.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-semibold rounded-2xl text-xs cursor-pointer transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
