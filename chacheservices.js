'use strict';

(function () {

    angular
        .module('gc.dataservice')
        .factory('dataServiceUtil', dataServiceUtil);

    dataServiceUtil.$inject = [
        '$window',
        '$http',
        '$cacheFactory',
        '$log',
        '$q',
        'sessionTokenSrv',
        'ENV',
        'user'
    ];

    function dataServiceUtil ( $window, $http, $cacheFactory, $log, $q, sessionTokenSrv, ENV, user ) {

        var cache = $cacheFactory('dataCache');

        var _map = {};
        var factoryService = {
            // registra una operazione pseudo-post
            registry: registry,
            // effettua  una chiamata verso i pseudo-servizi rest di integration service
            callOperation: callOperation,
            // gestione generico di errore non gestito e passato nel ramo di success
            handleNotManagedError: handleNotManagedError

        };

        return factoryService;

        // registra una operation con la chiamata mockata
        function registry(service, operation, mockedJson, mocked) {
            var operationName = service + "." + operation;
            var _mocked = mocked || false; // default non e' mockata

            if (!_map[service]) {
                $log.info("registrato il nuovo servizio : " + operationName);
                _map[service] = {};
            }
            // SALVO il servizio mockato
            _map[service][operation] = {
                "mockedJson": mockedJson,
                "mocked": mocked
            }
        }


        // effettua la chiamata verso il BE e restituisce una promessa

          function callOperation (service, operation, data, skipchache) {

              var _skipcache = skipchache || false;


              var operationName = service + "." + operation;
              var cacheId = operationName + '*' + JSON.stringify(data);
              var cachedPromise = cache.get(cacheId);

              if (cachedPromise) {
                  if(!_skipcache){
                    return cachedPromise;
                  }
              }

            try{
                var conf = $.extend({
                    'isMocked': false,
                    'mockedJson': ''
                }, _map[service][operation]);

                var mocked = ENV.allServicesMocked || conf.isMocked;
                var url = mocked || ENV.allServicesMocked ? conf.mockedJson : $window.location.origin + ENV.proxyBalancer + "/?" + operation;

               // CONF.apiEndpoint + "?SERVICE=" + service + "&OPERATION=" + operation;
                var method = mocked ? "GET" : "POST";

                var dataPromise = $http({
                    url: url,
                    method: "POST",
                     headers: {
                         "CODICEPB": user.profile.matricola, // todo HEADER integrare il codice PB nelle chiamate
                         "SERVICE": service,
                         "OPERATION": operation,
                         'Cache-Control' : 'no-cache',
                         "TOKEN" : "00000000-0000-0000-0000-000000000000" // sessionTokenSrv.getTokenSession()
                     },
                    data: {
                        root: data
                    }
                })
                    .error(logXHRError)
                    .then(handleNotManagedError);

                cache.put(cacheId, dataPromise);

                return dataPromise

            } catch (e) {
                $log.error("*** si e' verificato un errore in call Operation ***");
            }
        }


        function handleNotManagedError(response) {
            var ck = verifySuccessCode(response);

            $log.info("verifySuccessCode " + ck + " - " + response.config.headers.OPERATION);

            if(ck == "ERRORE_NON_GESTITO"){

                return $q.reject(response.data.response);

            }else if(ck == "ERRORE_GESTITO") {

                var errorObj = {
                    "errore": {
                        "codice":response.data.response.Esito.Codice,
                        "descrizione":response.data.response.Esito.Messaggio
                    }
                };

                return $q.reject(errorObj);

            }else {

                // aggiungo alla response l'operation e il service che derivano dai dati dell'header
                // in questo modo mi porto dietro due variabili da poter usare nei controller e nelle
                // direttive per indicare che tipo di chiamata è stata fatta
                //if ($.isPlainObject(response.data.response)) {
                //    response.data.response.OPERATION = response.config.headers.OPERATION;
                //    response.data.response.SERVICE = response.config.headers.SERVICE;
                //} else{
                //    response.data.response = {};
                //    response.data.response.OPERATION = response.config.headers.OPERATION;
                //    response.data.response.SERVICE = response.config.headers.SERVICE;
                //}

                //
                return response;
            }


            /*
            if ($.isPlainObject(response.data.response) && "errore" in response.data.response) {
                return $q.reject(response.data.response);
            }
            else {
                return response;
            }
            */
        }

        function verifySuccessCode(p_response){

            var retValue = "SUCCESS";

            //$log.info(p_response);

            if($.isPlainObject(p_response.data.response) && "errore" in p_response.data.response) {
                retValue = "ERRORE_NON_GESTITO";
            }

            if($.isPlainObject(p_response.data.response) && p_response.data.response.Esito){
                var codice = parseInt(p_response.data.response.Esito.Codice);
                if(codice != 0 && codice != "00"){
                    retValue = "ERRORE_GESTITO";
                }
            }

            return retValue;
        }

        function logXHRError(error) {
            $log.error('XHR Failed ' + error.data);
        }
    }

})();
