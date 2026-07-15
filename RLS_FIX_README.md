# 🔧 Solución: Error 406 RLS - Profesores y Padres

## 📋 Problema Detectado

**Error:** `406 PGRST116 - Cannot coerce the result to a single JSON object, The result contains 0 rows`

**Síntomas:**

- Las tareas no se muestran en el apartado del profesor
- Error aparece en `ParentProfile.tsx:57` (línea 44 real)
- Después de implementar el rol "parent" (padre de familia)

## 🔍 Causa Raíz

**Desincronización entre Base de Datos y Frontend:**

### Base de Datos (ENUM `user_role`)

```sql
-- Solo tenía 4 roles:
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student', 'parent');
```

### Frontend TypeScript

```typescript
// Pero el código esperaba 6 roles:
type UserRole =
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "tutor"
  | "directivo";
```

### Problemas Causados:

1. ❌ La función `has_role()` fallaba con roles no reconocidos
2. ❌ Las políticas RLS bloqueaban accesos válidos
3. ❌ Los queries con `.single()` fallaban cuando no había resultados (error 406)
4. ❌ Padres no tenían políticas RLS para ver información de sus hijos
5. ❌ Tutores y directivos no tenían políticas RLS definidas

## ✅ Solución Implementada

### 1. Nueva Migración SQL

**Archivo:** `supabase/migrations/20260102000000_add_tutor_directivo_roles.sql`

#### Cambios en el ENUM:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tutor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'directivo';
```

#### Políticas Actualizadas (para incluir 'tutor'):

- ✅ **Profesores/Tutores pueden ver sus cursos** - Actualizada
- ✅ **Profesores/Tutores pueden gestionar sus cursos** - Actualizada
- ✅ **Profesores/Tutores pueden gestionar tareas** - Actualizada
- ✅ **Profesores/Tutores pueden ver entregas** - Actualizada
- ✅ **Profesores/Tutores pueden calificar entregas** - Actualizada
- ✅ **Profesores/Tutores pueden gestionar exámenes** - Actualizada
- ✅ **Profesores/Tutores pueden gestionar asistencia** - Actualizada
- ✅ **Profesores/Tutores pueden gestionar anuncios** - Actualizada

#### Políticas Nuevas para Directivos:

- ✅ Pueden ver todos los perfiles
- ✅ Pueden ver todos los cursos
- ✅ Pueden ver todas las tareas
- ✅ Pueden ver todas las entregas
- ✅ Pueden ver toda la asistencia
- ✅ Pueden ver todos los exámenes
- ✅ Pueden ver todas las inscripciones

#### Políticas Nuevas para Padres:

- ✅ Pueden ver perfiles de sus hijos
- ✅ Pueden ver cursos de sus hijos
- ✅ Pueden ver tareas de sus hijos
- ✅ Pueden ver entregas de sus hijos
- ✅ Pueden ver asistencia de sus hijos (ya existía)
- ✅ Pueden ver perfiles de profesores de sus hijos
- ✅ Pueden ver exámenes de sus hijos
- ✅ Pueden ver anuncios de cursos de sus hijos

### 2. Corrección en Frontend

#### `useAuth.tsx`

```typescript
// ANTES (causaba error 406):
.single();

// DESPUÉS (maneja 0 rows correctamente):
.maybeSingle();
```

#### `ParentProfile.tsx`

```typescript
// Agregado manejo de error cuando no hay perfil:
if (data) {
  setProfile(data);
} else {
  console.warn("Profile not found or access denied");
  toast({
    title: "Advertencia",
    description: "No se pudo cargar el perfil.",
  });
}
```

## 🚀 Cómo Aplicar la Solución

### Opción 1: Usando el Script (Recomendado)

**En Windows:**

```cmd
apply-rls-migration.bat
```

**En Linux/Mac:**

```bash
chmod +x apply-rls-migration.sh
./apply-rls-migration.sh
```

### Opción 2: Manualmente con Supabase CLI

```bash
# 1. Asegúrate de estar en el directorio del proyecto
cd ProyectoWeb_laCampina

# 2. Aplicar la migración
supabase db push
```

### Opción 3: En Supabase Dashboard

1. Ve a tu proyecto en [https://supabase.com](https://supabase.com)
2. Navega a **SQL Editor**
3. Copia y pega el contenido de `supabase/migrations/20260102000000_add_tutor_directivo_roles.sql`
4. Ejecuta el SQL

## 🔬 Verificación

Después de aplicar la migración:

### 1. Verificar ENUM actualizado:

```sql
SELECT enum_range(NULL::user_role);
-- Debe retornar: {admin,teacher,student,parent,tutor,directivo}
```

### 2. Verificar políticas RLS:

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 3. Probar en la aplicación:

- ✅ Los profesores pueden ver sus tareas
- ✅ Los padres pueden ver información de sus hijos
- ✅ No aparece error 406
- ✅ No hay errores en la consola del navegador

## 📊 Tablas Afectadas

| Tabla                    | Nuevas Políticas            |
| ------------------------ | --------------------------- |
| `profiles`               | Tutores, Directivos, Padres |
| `courses`                | Tutores, Directivos, Padres |
| `assignments`            | Tutores, Directivos, Padres |
| `assignment_submissions` | Tutores, Directivos, Padres |
| `attendance`             | Directivos, Padres          |
| `exams`                  | Directivos                  |
| `announcements`          | Padres                      |

## 🔐 Relaciones Importantes

### Estructura de Relaciones:

```
auth.users (Supabase Auth)
    ↓ (user_id)
profiles (id, user_id, role ← ENUM user_role ✅ 6 roles)
    ↓ (teacher_id)
courses (id, teacher_id)
    ↓ (modulo_id)
assignments (id, modulo_id)
    ↓ (assignment_id)
assignment_submissions (id, assignment_id, student_id)

profiles (parent)
    ↓ (parent_id)
parent_student_relationships (parent_id, student_id)
    ↓ (student_id)
profiles (student)
```

## 🛡️ Función `has_role()`

**Ubicación:** Ya existía en la migración `20250917171902_*.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = _role
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
```

**✅ No requiere cambios** - Funciona automáticamente con el ENUM extendido.

## 📝 Notas Adicionales

### Perfiles Existentes con Roles Inválidos

Si antes de esta migración se intentó crear usuarios con roles `tutor` o `directivo`, esos registros pueden haber fallado. Para identificarlos:

```sql
-- Ver usuarios en auth.users sin perfil en profiles
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;
```

Si encuentras usuarios sin perfil, créalos manualmente:

```sql
INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
VALUES (
  'uuid-del-usuario',
  'email@example.com',
  'Nombre',
  'Apellido',
  'tutor' -- o 'directivo'
);
```

### Migración de Datos (si es necesario)

Si tienes usuarios que deberían ser tutores o directivos pero están marcados como teachers:

```sql
-- Actualizar roles específicos
UPDATE public.profiles
SET role = 'tutor'
WHERE id IN ('uuid1', 'uuid2', ...);

UPDATE public.profiles
SET role = 'directivo'
WHERE id IN ('uuid3', 'uuid4', ...);
```

## ⚠️ Precauciones

1. **Backup:** Haz un backup de tu base de datos antes de aplicar la migración
2. **Testing:** Prueba en un entorno de desarrollo primero
3. **Users activos:** Si hay usuarios activos, pídeles que cierren sesión y vuelvan a iniciar después de la migración
4. **Cache:** Limpia el cache del navegador si persisten errores

## 🆘 Troubleshooting

### Error: "role tutor does not exist in enum user_role"

**Causa:** La migración no se aplicó correctamente  
**Solución:** Ejecuta la migración nuevamente manualmente en SQL Editor

### Sigue apareciendo error 406

**Causa:** Cache del navegador o sesión antigua  
**Solución:**

1. Cierra sesión
2. Limpia cache del navegador (Ctrl + Shift + Delete)
3. Inicia sesión nuevamente

### RLS sigue bloqueando acceso

**Causa:** Las políticas pueden tardar unos segundos en propagarse  
**Solución:**

1. Espera 30 segundos
2. Refresca la página
3. Verifica que las políticas existen en el Dashboard de Supabase

## 📞 Soporte

Si después de aplicar estas soluciones persisten los problemas:

1. Revisa los logs del navegador (F12 → Console)
2. Revisa los logs de Supabase (Dashboard → Logs)
3. Verifica que el usuario tiene un perfil válido en la tabla `profiles`
4. Verifica que las relaciones `parent_student_relationships` están correctamente configuradas

---

**Fecha de implementación:** 2 de enero de 2026  
**Versión de migración:** 20260102000000
