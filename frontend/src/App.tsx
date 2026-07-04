import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Activos from './pages/Activos'
import ActivoDetalle from './pages/ActivoDetalle'
import ActivoForm from './pages/ActivoForm'
import MapaActivos from './pages/MapaActivos'
import Reuniones from './pages/Reuniones'
import ReunionDetalle from './pages/ReunionDetalle'
import ReunionForm from './pages/ReunionForm'
import OrdenDelDia from './pages/OrdenDelDia'
import PuntoGestion from './pages/PuntoGestion'
import GestionActa from './pages/GestionActa'
import NuevaReunionDesdeConvocatoria from './pages/NuevaReunionDesdeConvocatoria'
import NuevaActaDesdePDF from './pages/NuevaActaDesdePDF'
import Asistencias from './pages/Asistencias'
import Compromisos from './pages/Compromisos'
import MisCompromisos from './pages/MisCompromisos'
import Documentos from './pages/Documentos'
import Buscar from './pages/Buscar'
import MiCuenta from './pages/MiCuenta'
// Tags / Memoria Corporativa
import TagHistoria from './pages/TagHistoria'
// Finanzas Corporativas
import Finanzas from './pages/Finanzas'
import FinanzasDetalle from './pages/FinanzasDetalle'
import FinanzasForm from './pages/FinanzasForm'
import FinanzasImportar from './pages/FinanzasImportar'
// Ajustes
import Empresas from './pages/ajustes/Empresas'
import Organos from './pages/ajustes/Organos'
import AjustesPersonas from './pages/ajustes/Personas'
import AjustesUsuarios from './pages/ajustes/Usuarios'
import AjustesGrupos from './pages/ajustes/Grupos'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones"
        element={
          <ProtectedRoute>
            <Reuniones />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/desde-convocatoria"
        element={
          <ProtectedRoute>
            <NuevaReunionDesdeConvocatoria />
          </ProtectedRoute>
        }
      />
      <Route
        path="/actas/nueva-desde-pdf"
        element={
          <ProtectedRoute>
            <NuevaActaDesdePDF />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/nueva"
        element={
          <ProtectedRoute>
            <ReunionForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id/editar"
        element={
          <ProtectedRoute>
            <ReunionForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id/orden-del-dia"
        element={
          <ProtectedRoute>
            <OrdenDelDia />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id/puntos/:puntoId"
        element={
          <ProtectedRoute>
            <PuntoGestion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id/acta"
        element={
          <ProtectedRoute>
            <GestionActa />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id/asistentes"
        element={
          <ProtectedRoute>
            <Asistencias />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reuniones/:id"
        element={
          <ProtectedRoute>
            <ReunionDetalle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compromisos"
        element={
          <ProtectedRoute>
            <Compromisos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-compromisos"
        element={
          <ProtectedRoute>
            <MisCompromisos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentos"
        element={
          <ProtectedRoute>
            <Documentos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buscar"
        element={
          <ProtectedRoute>
            <Buscar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mi-cuenta"
        element={
          <ProtectedRoute>
            <MiCuenta />
          </ProtectedRoute>
        }
      />
      {/* ── Módulo Ajustes (solo is_staff) ─────────────────────────────── */}
      <Route path="/ajustes" element={<Navigate to="/ajustes/empresas" replace />} />
      <Route
        path="/ajustes/empresas"
        element={<AdminRoute><Empresas /></AdminRoute>}
      />
      <Route
        path="/ajustes/organos"
        element={<AdminRoute><Organos /></AdminRoute>}
      />
      <Route
        path="/ajustes/personas"
        element={<AdminRoute><AjustesPersonas /></AdminRoute>}
      />
      <Route
        path="/ajustes/usuarios"
        element={<AdminRoute><AjustesUsuarios /></AdminRoute>}
      />
      <Route
        path="/ajustes/grupos"
        element={<AdminRoute><AjustesGrupos /></AdminRoute>}
      />

      {/* ── Tags / Memoria Corporativa ──────────────────────────────────── */}
      <Route
        path="/tags/:slug"
        element={<ProtectedRoute><TagHistoria /></ProtectedRoute>}
      />

      {/* ── Módulo Activos (Paz Holding) ────────────────────────────────── */}
      <Route
        path="/activos"
        element={<ProtectedRoute><Activos /></ProtectedRoute>}
      />
      {/* /activos/mapa ANTES de /activos/:id para que no lo tome como id */}
      <Route
        path="/activos/mapa"
        element={<ProtectedRoute><MapaActivos /></ProtectedRoute>}
      />
      <Route
        path="/activos/nuevo"
        element={<ProtectedRoute><ActivoForm /></ProtectedRoute>}
      />
      <Route
        path="/activos/:id"
        element={<ProtectedRoute><ActivoDetalle /></ProtectedRoute>}
      />
      <Route
        path="/activos/:id/editar"
        element={<ProtectedRoute><ActivoForm /></ProtectedRoute>}
      />

      {/* ── Módulo Finanzas Corporativas ────────────────────────────────── */}
      <Route
        path="/finanzas"
        element={<ProtectedRoute><Finanzas /></ProtectedRoute>}
      />
      <Route
        path="/finanzas/importar"
        element={<ProtectedRoute><FinanzasImportar /></ProtectedRoute>}
      />
      <Route
        path="/finanzas/subir"
        element={<ProtectedRoute><FinanzasForm /></ProtectedRoute>}
      />
      <Route
        path="/finanzas/:id"
        element={<ProtectedRoute><FinanzasDetalle /></ProtectedRoute>}
      />
      <Route
        path="/finanzas/:id/editar"
        element={<ProtectedRoute><FinanzasForm /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
