import { setModuleReader } from 'locter';

setModuleReader({ load: (id) => import(id) });
