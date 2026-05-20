import { Test, TestingModule } from '@nestjs/testing';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('RF-02 WebSocket Balance Update (e2e)', () => {
  let app: INestApplication;
  let socket: Socket | null = null;
  let serverUrl: string;
  let tokenUser: string;
  let tokenAdmin: string;
  let accountId: number;

  const cleanupSocket = () => {
    try {
      if (socket) {
        try {
          socket.removeAllListeners();
        } catch (e) {
          /* ignore */
        }

        try {
          socket.disconnect();
        } catch (e) {
          /* ignore */
        }

        socket = null;
      }
    } catch (err) {
      // defensive
      console.error('Error cleaning up socket:', err);
      socket = null;
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    // mismo prefijo del main.ts
    app.setGlobalPrefix('api');

    await app.listen(0);

    const address = app.getHttpServer().address() as {
      port: number;
    };

    serverUrl = `http://127.0.0.1:${address.port}`;

    console.log(
      '🚀 Test server running:',
      serverUrl,
    );

    // Login usuario
    const userLogin = await request(
      app.getHttpServer(),
    )
      .post('/api/auth/login')
      .send({
        email: 'usuario2@test.com',
        password: '123456',
      });

    tokenUser =
      userLogin.body.access_token;

    console.log(
      '✅ User token:',
      !!tokenUser,
    );

    // Login admin
    const adminLogin = await request(
      app.getHttpServer(),
    )
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: '123456',
      });

    tokenAdmin =
      adminLogin.body.access_token;

    console.log(
      '✅ Admin token:',
      !!tokenAdmin,
    );

    // Obtener cuenta usuario
    const accountResponse =
      await request(
        app.getHttpServer(),
      )
        .get('/api/accounts/me')
        .set(
          'Authorization',
          `Bearer ${tokenUser}`,
        );

    console.log(
      '📦 Account response:',
      accountResponse.body,
    );

    accountId =
      accountResponse.body.id;
  });

  afterAll(async () => {
    try {
      cleanupSocket();

      // give some time for pending logs to flush before closing app
      await new Promise((r) => setTimeout(r, 50));

      await app.close();
    } catch (error) {
      console.error('Error cerrando recursos:', error);
    }
  });

  it(
    'debe recibir balance.updated después de depósito',
    async () => {
      await new Promise<void>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            try {
              cleanupSocket();
            } catch (e) {
              /* ignore */
            }

            reject(new Error('Timeout esperando balance.updated'));
          }, 10000);

          socket = io(
            `${serverUrl}/notifications`,
            {
              auth: {
                token: tokenUser,
              },

              extraHeaders: {
                Authorization: `Bearer ${tokenUser}`,
              },

              transports: [
                'websocket',
              ],
              forceNew: true,
              reconnection: false,
            },
          );

          socket.once('connect', async () => {
              console.log(
                '✅ Socket conectado',
              );

              console.log(
                'Socket ID:',
                socket?.id,
              );

              socket?.once('connection_established', (msg) => {
                console.log('✅ WS AUTH OK', msg);
              });

              socket?.once('balance.updated', (data) => {
                  console.log(
                    '🔥 BALANCE EVENT',
                    data,
                  );

                  try {
                    clearTimeout(timeout);

                    expect(data).toHaveProperty('saldo');
                    expect(data).toHaveProperty('accountId');

                    cleanupSocket();

                    resolve();
                  } catch (err) {
                    reject(err);
                  }
                },
              );

              console.log(
                '🚀 Ejecutando depósito...',
              );

              const response =
                await request(
                  app.getHttpServer(),
                )
                  .post(
                    '/api/transfer/deposit',
                  )
                  .set(
                    'Authorization',
                    `Bearer ${tokenAdmin}`,
                  )
                  .send({
                    toAccountId:
                      accountId,
                    amount: 100,
                  });

              console.log(
                '💰 Deposit response:',
                response.body,
              );
            },
          );

          socket.once('connect_error', (err) => {
            clearTimeout(timeout);

            try {
              cleanupSocket();
            } catch (e) {
              /* ignore */
            }

            console.error('❌ CONNECT ERROR:', err);

            reject(err);
          });
        },
      );
    },
    20000,
  );

  it(
    'debe recibir balance.updated después de retiro',
    async () => {
      await new Promise<void>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            try {
              cleanupSocket();
            } catch (e) {
              /* ignore */
            }

            reject(new Error('Timeout esperando balance.updated'));
          }, 10000);

          socket = io(
            `${serverUrl}/notifications`,
            {
              auth: {
                token: tokenUser,
              },

              extraHeaders: {
                Authorization: `Bearer ${tokenUser}`,
              },

              transports: [
                'websocket',
              ],
              forceNew: true,
              reconnection: false,
            },
          );

          socket.once('connect', async () => {
            console.log('✅ Socket conectado (retiro)');

            socket?.once('connection_established', (msg) => {
              console.log('✅ WS AUTH OK', msg);
            });

            socket?.once('balance.updated', (data) => {
                  console.log(
                    '🔥 BALANCE EVENT RETIRO',
                    data,
                  );

                  try {
                    clearTimeout(timeout);

                    expect(data).toHaveProperty('saldo');
                    expect(data).toHaveProperty('accountId');

                    cleanupSocket();

                    resolve();
                  } catch (err) {
                    reject(err);
                  }
                },
              );

              console.log(
                '🚀 Ejecutando retiro...',
              );

              const response =
                await request(
                  app.getHttpServer(),
                )
                  .post(
                    '/api/transfer/withdraw',
                  )
                  .set(
                    'Authorization',
                    `Bearer ${tokenUser}`,
                  )
                  .send({
                    amount: 50,
                  });

              console.log(
                '💸 Withdraw response:',
                response.body,
              );
            },
          );

          socket.once('connect_error', (err) => {
            clearTimeout(timeout);

            try {
              cleanupSocket();
            } catch (e) {
              /* ignore */
            }

            console.error('❌ CONNECT ERROR:', err);

            reject(err);
          });
        },
      );
    },
    20000,
  );
});