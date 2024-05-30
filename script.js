///// REGISTRA PWA /////

function invokeServiceWorkerUpdateFlow(registration) {
    // TODO implement your own UI notification element
    if (confirm("Hay una nueva versión de la aplicación. Actualizar ahora?")) {
        if (registration.waiting) {
            // let waiting Service Worker know it should became active
            registration.waiting.postMessage('SKIP_WAITING')
        }
    }
};

// check if the browser supports serviceWorker at all
if ('serviceWorker' in navigator) {
    // wait for the page to load
    window.addEventListener('load', async () => {
        // register the service worker from the file specified
        const registration = await navigator.serviceWorker.register('./service-worker.js')

        // ensure the case when the updatefound event was missed is also handled
        // by re-invoking the prompt when there's a waiting Service Worker
        if (registration.waiting) {
            invokeServiceWorkerUpdateFlow(registration)
        }

        // detect Service Worker update available and wait for it to become installed
        registration.addEventListener('updatefound', () => {
            if (registration.installing) {
                // wait until the new Service worker is actually installed (ready to take over)
                registration.installing.addEventListener('statechange', () => {
                    if (registration.waiting) {
                        // if there's an existing controller (previous Service Worker), show the prompt
                        if (navigator.serviceWorker.controller) {
                            invokeServiceWorkerUpdateFlow(registration)
                        } else {
                            // otherwise it's the first install, nothing to do
                            console.log('Service Worker initialized for the first time')
                        }
                    }
                })
            }
        })

        let refreshing = false;

        // detect controller change and refresh the page
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload()
                refreshing = true
            }
        })
    })
};





///// Inicializar IndexedDB /////
var db;
const request = indexedDB.open('teleprompterDB', 1);

request.onerror = function(event) {
    console.error('Database error:', event.target.errorCode);
};

request.onsuccess = function(event) {
    db = event.target.result;
    loadScriptsList();
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const objectStore = db.createObjectStore('scripts', { keyPath: 'id', autoIncrement: true });
    objectStore.createIndex('name', 'name', { unique: false });
    objectStore.createIndex('text', 'text', { unique: false });
};

// Función para obtener el store de scripts
function getScriptsStore(mode) {
    const transaction = db.transaction(['scripts'], mode);
    return transaction.objectStore('scripts');
}

// Función para guardar un script
function saveScript(id, name, text) {
    const store = getScriptsStore('readwrite');
    const script = { name: name, text: text };
    if (id) {
        script.id = id;
    }
    const request = store.put(script);

    request.onsuccess = function() {
        //alert('Script guardado con éxito');
        loadScriptsList();
        hideEditor();
    };

    request.onerror = function(event) {
        alert('Error al guardar el script: ' + event.target.errorCode);
    };
}

// Función para cargar un script
function loadScript(id) {
    const store = getScriptsStore('readonly');
    const request = store.get(id);

    request.onsuccess = function(event) {
        const result = event.target.result;
        if (result) {
            document.getElementById('teleprompter').innerHTML = result.text;
            document.getElementById('scriptName').value = result.name;
            document.getElementById('scriptId').value = result.id;
            showEditor();
        } else {
            alert('Script no encontrado');
        }
    };

    request.onerror = function(event) {
        alert('Error al cargar el script: ' + event.target.errorCode);
    };
}

// Función para eliminar un script
function deleteScript(id) {
    const store = getScriptsStore('readwrite');
    const request = store.delete(id);

    request.onsuccess = function() {
        // alert('Script eliminado con éxito');
        loadScriptsList();
    };

    request.onerror = function(event) {
        alert('Error al eliminar el script: ' + event.target.errorCode);
    };
}

// Función para cargar la lista de scripts en listsScripts
function loadScriptsList() {
    const store = getScriptsStore('readonly');
    if (!store) return;

    const scriptsList = document.getElementById('scriptsList');
    scriptsList.innerHTML = '';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search';
    searchInput.placeholder = 'Buscar scripts...';
    searchInput.style = 'border-radius: 20px; width: 100%; padding: 10px; margin-bottom: 10px;';
    scriptsList.appendChild(searchInput);

    // Abre un cursor para recorrer el almacén en orden descendente
    const request = store.openCursor(null, 'prev');

    request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const script = cursor.value;

            const scriptItem = document.createElement('div');
            scriptItem.className = 'script-item';
            //scriptItem.style.display = 'flex';
            //scriptItem.style.flexDirection = 'column';

            const textSnippet = document.createElement('div');
            textSnippet.className = 'text-snippet';
            textSnippet.append(new DOMParser().parseFromString(script.text
                .replace(/<div>/g, '\n')
                .replace(/<br>/g, '\n')
                , 'text/html')
                .body.textContent.slice(0, 100) + '...');

            const scriptName = document.createElement('div');
            scriptName.textContent = script.name;
            scriptName.className = 'script-name';
            scriptName.dataset.id = script.id;
            //scriptName.style.fontSize = '14px';
            //scriptName.style.color = 'whitesmoke';

            const loadButton = document.createElement('button');
            loadButton.className = 'load-script-button';
            loadButton.innerHTML = '<i class="fas fa-play"></i>';
            loadButton.onclick = (e) => {
                e.stopPropagation();
                loadScript(script.id);
                console.log('Script cargado');
            };

            scriptItem.appendChild(scriptName);
            scriptItem.appendChild(textSnippet);
            scriptItem.appendChild(loadButton);

            scriptItem.onclick = () => {
                loadScript(script.id);
            }

            scriptItem.oncontextmenu = (e) => {
                e.preventDefault();
                const del = confirm(`¿Deseas eliminar el script "${script.name}"?`);
                if (del) {
                    deleteScript(script.id);
                }
            }

            scriptsList.appendChild(scriptItem);

            cursor.continue();
        } else {

            // Forzar el recálculo del diseño para el contenedor de scripts
            scriptsList.style.display = 'none';
            scriptsList.offsetHeight; // Forzar reflow
            scriptsList.style.display = 'flex'; 

            const newScriptButton = document.createElement('button');
            newScriptButton.id = 'newScriptButton';
            newScriptButton.className = 'new-script-button';
            newScriptButton.style = 'width:60px;height:60px;position: fixed;background-color:green;border-radius: 50%;z-index: 1050;';
            newScriptButton.innerHTML = '<i class="fa-solid fa-plus"></i>';
            newScriptButton.onclick = createNewScript;
            newScriptButton.style.display = 'block';
            scriptsList.appendChild(newScriptButton);

            var scriptElements = document.querySelectorAll('.script-item'); // Select all elements with class 'script-item'
            searchInput.oninput = () => {
                const filter = searchInput.value.toLowerCase(); // Use searchInput.value instead of search.value
                scriptElements.forEach(script => {
                    const scriptName = script.querySelector('.script-name'); // Get the script name element
                    const scriptText = script.querySelector('.text-snippet'); // Get the script text element
                    if (scriptName.textContent.toLowerCase().includes(filter) || scriptText.textContent.toLowerCase().includes(filter)) {
                        script.style.display = 'flex'; // Show the script item
                    } else {
                        script.style.display = 'none'; // Hide the script item
                    }
                });
            };
        }
    };

    request.onerror = function(event) {
        alert('Error al cargar la lista de scripts: ' + event.target.errorCode);
    };
}


// Función para crear un nuevo script
function createNewScript() {
    document.getElementById('teleprompter').innerHTML = '';
    // parrafo = document.createElement('p');
    // parrafo.textContent = 'Escribe aquí tu texto...';
    // document.getElementById('teleprompter').appendChild(parrafo);
    document.getElementById('scriptName').value = '';
    document.getElementById('scriptId').value = '';
    showEditor();
}

// Mostrar y ocultar el editor
function showEditor() {
    document.getElementById('teleprompterContainer').style.display = 'block';
    document.getElementById('scriptsList').style.display = 'none';
    document.getElementById('newScriptButton').style.display = 'none';
}

function hideEditor() {
    document.getElementById('teleprompterContainer').style.display = 'none';
    document.getElementById('scriptsList').style.display = 'block';
    // document.getElementById('newScriptButton').style.display = 'block';
}


// Funciones del teleprompter
document.getElementById('saveText').addEventListener('click', () => {
    const name = document.getElementById('scriptName').value;
    const text = document.getElementById('teleprompter').innerHTML;
    const id = document.getElementById('scriptId').value;
    if (name) {
        saveScript(id ? parseInt(id) : null, name, text);
    } else {
        alert('El nombre del script no puede estar vacío.');
    }
});


// Función para que resetea el editor completamente, al guardar lo hará en un nuevo script
document.getElementById('resetButton').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres resetear el teleprompter? Esto eliminará todo el contenido.')) {
        document.getElementById('teleprompter').innerHTML = '';
        document.getElementById('scriptName').value = '';
        document.getElementById('scriptId').value = '';
    }
});
