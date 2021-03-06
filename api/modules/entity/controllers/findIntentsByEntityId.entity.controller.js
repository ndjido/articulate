'use strict';
const Async = require('async');
const Boom = require('boom');
const Cast = require('../../../helpers/cast');
const _ = require('lodash');

module.exports = (request, reply) => {

    const server = request.server;
    const redis = server.app.redis;
    let start = 0;
    if (request.query && request.query.start > -1) {
        start = request.query.start;
    }
    let limit = -1;
    if (request.query && request.query.limit > -1) {
        limit = request.query.limit;
    }
    const id = request.params.id;

    Async.waterfall([
        (cb) => {

            redis.zrange(`entityIntents:${id}`, start, limit, 'withscores', (err, intents) => {

                if (err) {
                    const error = Boom.badImplementation('An error occurred getting the intents from the sorted set.');
                    return cb(error);
                }
                intents = _.chunk(intents, 2);
                return cb(null, intents);
            });
        },
        (intents, cb) => {

            Async.map(intents, (intent, callback) => {

                server.inject(`/intent/${intent[1]}`, (res) => {

                    if (res.statusCode !== 200) {
                        const error = Boom.create(res.statusCode, `An error occurred getting the data of the intent ${intent[0]} with id ${intent[1]}`);
                        return callback(error, null);
                    }
                    return callback(null, res.result);
                });

            }, (err, result) => {

                if (err) {
                    return cb(err, null);
                }
                return cb(null, result);
            });
        }
    ], (err, result) => {

        if (err) {
            return reply(err, null);
        }
        result = _.flatten(result).map((intent) => {

            return Cast(intent, 'intent');
        });
        return reply(result);
    });
};
