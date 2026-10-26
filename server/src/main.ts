import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(json({
    limit: '5mb',
    verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; },
  }));
  app.use(urlencoded({ limit: '5mb', extended: true }));
  app.enableCors();
  app.enableShutdownHooks();

  const publicDir = path.join(process.cwd(), 'public');
  app.useStaticAssets(path.join(publicDir, 'website'));
  app.useStaticAssets(path.join(publicDir, 'admin'), { prefix: '/admin' });

  const adminIndex = path.join(publicDir, 'admin', 'index.html');
  app.use('/admin', (req: any, res: any, next: any) => {
    const isApiCall = !!req.headers['authorization'] || req.headers['accept']?.includes('application/json');
    if (req.method === 'GET' && !req.path.includes('.') && !isApiCall) {
      res.sendFile(adminIndex);
    } else {
      next();
    }
  });

  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
