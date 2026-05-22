✅ RESUMEN DE CAMBIOS EN DASHBOARD

PROBLEMA:

- El selector de almacenes en el Dashboard no mostraba los almacenes disponibles
- Estaba usando un hook secundario que no cargaba datos correctamente

SOLUCIÓN IMPLEMENTADA:

1. Cambié la interfaz DashboardProps:

   - Antes: warehouses?: Warehouse[] (OPCIONAL)
   - Ahora: warehouses: Warehouse[] (REQUERIDO)

2. Simplificé la lógica de carga:

   - Eliminé el hook useWarehouses() del Dashboard
   - Ahora usa solo los datos que vienen desde App.tsx
   - El hook ya se ejecuta en App.tsx y se pasan los almacenes como props

3. Limpié el código:

   - Removí referencias a "effectiveWarehouses"
   - Removí referencias a "warehousesHook"
   - Todo ahora usa directamente la prop "warehouses"

4. El filtrado ya estaba funcionando:
   - selectedWarehouseId se usa correctamente para filtrar ventas, transferencias, etc.
   - Los cálculos de KPIs ya respetan el filtro

PRÓXIMOS PASOS:

1. Recarga la app (F5)
2. Ve al Dashboard
3. Verifica que el selector "Filtrar por Almacén" ahora muestre:

   - "Todos los almacenes (2)"
   - "Almacén Tánger"
   - "OLJDA"

4. Prueba cambiar entre almacenes y verifica que los datos se filtren correctamente

Si aún no funciona, abre F12 > Console y busca el log "Dashboard props" para verificar que warehouses se pasó correctamente.
