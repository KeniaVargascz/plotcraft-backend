import { main } from './seeds';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
